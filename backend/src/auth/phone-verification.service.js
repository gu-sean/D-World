import { timingSafeEqual } from 'node:crypto';
import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { hmacHex, randomCode } from '../common/crypto/crypto.js';
import { SMS_SENDER } from './sms/sms-sender.js';

const CODE_TTL_MINUTES = 3;
const RESEND_COOLDOWN_SEC = 30;
const HOURLY_LIMIT = 5;
const MAX_ATTEMPTS = 5;
export const CONFIRMED_TTL_MINUTES = 10;

const codeInvalid = () =>
  new AppException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'code_invalid',
    '인증번호가 올바르지 않음',
  );

@Injectable()
@Dependencies(DatabaseService, ConfigService, SMS_SENDER)
export class PhoneVerificationService {
  logger = new Logger(PhoneVerificationService.name);

  constructor(database, config, smsSender) {
    this.database = database;
    this.config = config;
    this.smsSender = smsSender;
  }

  // 6자리는 무차별 대입에 약하므로 서버 키가 있는 HMAC으로 저장
  hashCode(phone, purpose, code) {
    return hmacHex(
      this.config.get('PHONE_CODE_PEPPER') ??
        this.config.get('JWT_ACCESS_SECRET'),
      `phone-code:${phone}:${purpose}:${code}`,
    );
  }

  /**
   * 인증번호 발급·발송
   * 같은 번호·목적 30초 재발송 대기, 같은 번호 시간당 5회, 재발송 시 이전 코드 무효
   */
  async send(phone, purpose) {
    const code = randomCode();
    const challengeId = newId();
    let expiresAt;

    const resendAvailableAt = new Date(Date.now() + RESEND_COOLDOWN_SEC * 1000);
    await this.database.withTransaction(async (tx) => {
      // 같은 번호의 동시 요청이 제한 검사를 함께 통과하지 못하게 직렬화
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `phone-code:${phone}`,
      ]);

      const recent = await tx.query(
        `SELECT EXTRACT(EPOCH FROM (now() - created_at)) AS age
           FROM phone_verification_challenges
          WHERE phone_e164 = $1 AND purpose = $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [phone, purpose],
      );
      const age = recent.rows[0] ? Number(recent.rows[0].age) : Infinity;
      if (age < RESEND_COOLDOWN_SEC) {
        throw new AppException(
          HttpStatus.TOO_MANY_REQUESTS,
          'code_rate_limited',
          '잠시 후 다시 요청해야 함',
          { retryAfter: Math.ceil(RESEND_COOLDOWN_SEC - age) },
        );
      }

      const hourly = await tx.query(
        `SELECT count(*) AS n,
                EXTRACT(EPOCH FROM (min(created_at) + interval '1 hour' - now())) AS wait
           FROM phone_verification_challenges
          WHERE phone_e164 = $1 AND created_at > now() - interval '1 hour'`,
        [phone],
      );
      if (Number(hourly.rows[0].n) >= HOURLY_LIMIT) {
        throw new AppException(
          HttpStatus.TOO_MANY_REQUESTS,
          'code_rate_limited',
          '인증번호 요청 횟수 초과',
          { retryAfter: Math.max(1, Math.ceil(Number(hourly.rows[0].wait))) },
        );
      }

      await tx.query(
        `UPDATE phone_verification_challenges
            SET invalidated_at = now()
          WHERE phone_e164 = $1 AND purpose = $2
            AND consumed_at IS NULL AND invalidated_at IS NULL`,
        [phone, purpose],
      );
      const inserted = await tx.query(
        `INSERT INTO phone_verification_challenges
                (id, phone_e164, purpose, code_hash, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))
         RETURNING expires_at`,
        [
          challengeId,
          phone,
          purpose,
          this.hashCode(phone, purpose, code),
          CODE_TTL_MINUTES,
        ],
      );
      expiresAt = inserted.rows[0].expires_at;
    });

    // 외부 호출은 커밋 뒤에 수행해 잠금을 오래 쥐지 않음
    try {
      await this.smsSender.send(
        phone,
        `[D-World] 인증번호 ${code} (${CODE_TTL_MINUTES}분 이내 입력)`,
      );
    } catch (error) {
      this.logger.error(`문자 발송 실패: ${error.message}`);
      await this.database.query(
        'UPDATE phone_verification_challenges SET invalidated_at = now() WHERE id = $1',
        [challengeId],
      );
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'sms_unavailable',
        '문자를 보낼 수 없음',
      );
    }
    return { challengeId, expiresAt, resendAvailableAt };
  }

  /**
   * 인증번호 확인(A02): 코드가 맞으면 가입·재설정 단계를 마칠 시간(CONFIRMED_TTL_MINUTES)만큼 유효기간을 늘림
   * 다음 단계에서 같은 challenge를 consume 한다
   */
  async confirm(challengeId, phone, purpose, code) {
    const checked = await this.check(phone, purpose, code);
    if (checked !== challengeId) throw codeInvalid();
    const { rows } = await this.database.query(
      `UPDATE phone_verification_challenges
          SET expires_at = now() + make_interval(mins => $2)
        WHERE id = $1
        RETURNING expires_at`,
      [challengeId, CONFIRMED_TTL_MINUTES],
    );
    return rows[0].expires_at;
  }

  /**
   * 최신 유효 코드와 대조해 challenge id 반환(소비하지 않음)
   * 오답 횟수는 오류를 던지기 전에 커밋하고, 5회째 오답이면 코드를 무효화
   */
  async check(phone, purpose, code) {
    const outcome = await this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT id, code_hash, attempt_count, expires_at <= now() AS expired
           FROM phone_verification_challenges
          WHERE phone_e164 = $1 AND purpose = $2
            AND consumed_at IS NULL AND invalidated_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
            FOR UPDATE`,
        [phone, purpose],
      );
      const challenge = rows[0];
      if (!challenge) return { error: 'invalid' };
      if (challenge.expired) return { error: 'expired' };

      const expected = Buffer.from(challenge.code_hash, 'hex');
      const actual = Buffer.from(this.hashCode(phone, purpose, code), 'hex');
      if (
        expected.length === actual.length &&
        timingSafeEqual(expected, actual)
      ) {
        return { id: challenge.id };
      }

      await tx.query(
        `UPDATE phone_verification_challenges
            SET attempt_count = attempt_count + 1,
                invalidated_at = CASE WHEN attempt_count + 1 >= $2 THEN now() END
          WHERE id = $1`,
        [challenge.id, MAX_ATTEMPTS],
      );
      return { error: 'invalid' };
    });

    if (outcome.error === 'expired') {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'code_expired',
        '인증번호가 만료됨',
      );
    }
    if (outcome.error) throw codeInvalid();
    return outcome.id;
  }

  /** 가입·재설정 트랜잭션 안에서 코드를 소비, 동시에 두 번 쓰이지 않도록 조건부 갱신 */
  async consume(tx, challengeId) {
    const { rowCount } = await tx.query(
      `UPDATE phone_verification_challenges
          SET consumed_at = now()
        WHERE id = $1
          AND consumed_at IS NULL AND invalidated_at IS NULL
          AND expires_at > now()`,
      [challengeId],
    );
    if (rowCount === 0) throw codeInvalid();
  }
}
