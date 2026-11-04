import { createHash, timingSafeEqual } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app-exception.js';
import { rethrowConstraint } from '../../common/errors/constraint.js';
import { DatabaseService } from '../../database/database.service.js';
import { DecisionService } from '../decision.service.js';

const digest = (value) => createHash('sha256').update(String(value)).digest();

/**
 * AI 판정 결과 수신 (3-C-3)
 * AI 서비스(FastAPI)가 공유 비밀 헤더로 호출, 사용자·관리자 토큰 미사용
 * 규격(ingestKey 형식, 인증 방식, 신뢰도 임곗값)은 AI 쪽과 확정 전까지 이 제안안 적용
 */
@Injectable()
@Dependencies(DatabaseService, ConfigService, DecisionService)
export class AiIngestService {
  constructor(database, config, decisions) {
    this.database = database;
    this.config = config;
    this.decisions = decisions;
  }

  /** 공유 비밀 확인: 설정이 없으면 엔드포인트를 닫고, 불일치는 상수 시간으로 비교해 401 */
  assertSecret(request) {
    const expected = this.config.get('AI_INGEST_SECRET');
    if (!expected) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'ai_ingest_disabled',
        'AI 결과 수신이 설정되지 않음',
      );
    }
    const given = request.headers?.['x-internal-token'];
    if (
      typeof given !== 'string' ||
      !timingSafeEqual(digest(given), digest(expected))
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'unauthorized',
        '인증 필요',
      );
    }
  }

  /**
   * 결과 반영: 같은 ingestKey는 한 번만 처리하고(재전송은 첫 결과 반환),
   * 이미 판정이 끝났거나 종료된 회차에 늦게 온 결과는 기록하지 않고 ignored로 응답
   */
  async ingest(input) {
    try {
      const result = await this.database.withTransaction((tx) =>
        this.decisions.applyDecision(tx, {
          ...input,
          source: 'ai',
          allowedStatuses: ['submitted'],
          ignoreIfNotJudgeable: true,
        }),
      );
      return {
        status: result.outcome,
        ...(result.resultId ? { resultId: result.resultId } : {}),
        ...(result.decision ? { decision: result.decision } : {}),
        ...(result.transition ? { transition: result.transition } : {}),
        ...(result.missionStatus
          ? { missionStatus: result.missionStatus }
          : {}),
        ...(result.recordStatus ? { recordStatus: result.recordStatus } : {}),
      };
    } catch (err) {
      // 다른 회차에서 같은 ingestKey가 동시에 들어온 경우
      rethrowConstraint(err, {
        verification_results_ingest_key_uq: () =>
          new AppException(
            HttpStatus.CONFLICT,
            'ingest_key_reused',
            '같은 ingestKey로 다른 요청이 처리됨',
          ),
      });
    }
  }
}
