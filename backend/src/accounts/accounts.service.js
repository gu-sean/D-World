import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { rethrowConstraint } from '../common/errors/constraint.js';
import { ConsentService } from './consent.service.js';
import { RestrictionService } from './restriction.service.js';

export const nicknameTaken = () =>
  new AppException(
    HttpStatus.CONFLICT,
    'nickname_taken',
    '이미 사용 중인 닉네임',
  );

/** 010-1234-5678 → +82*******5678 (뒤 4자리만 노출) */
export function maskPhone(e164) {
  return `${e164.slice(0, 3)}${'*'.repeat(Math.max(e164.length - 7, 0))}${e164.slice(-4)}`;
}

@Injectable()
@Dependencies(DatabaseService, ConsentService, RestrictionService)
export class AccountsService {
  constructor(database, consents, restrictions) {
    this.database = database;
    this.consents = consents;
    this.restrictions = restrictions;
  }

  async isNicknameAvailable(nickname) {
    const { rowCount } = await this.database.query(
      'SELECT 1 FROM profiles WHERE lower(nickname) = lower($1)',
      [nickname],
    );
    return rowCount === 0;
  }

  async getMe(userId) {
    const [account, phone, identities, restriction, pending] =
      await Promise.all([
        this.database.query(
          `SELECT u.id, u.status, p.nickname, p.notification_enabled, u.created_at
           FROM users u JOIN profiles p ON p.user_id = u.id
          WHERE u.id = $1`,
          [userId],
        ),
        this.database.query(
          'SELECT phone_e164 FROM phone_credentials WHERE user_id = $1',
          [userId],
        ),
        this.database.query(
          'SELECT provider FROM user_identities WHERE user_id = $1 ORDER BY provider',
          [userId],
        ),
        this.restrictions.activeRestriction(userId),
        this.consents.pendingReconsent(userId),
      ]);
    const row = account.rows[0];
    if (!row) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'not_found',
        '계정을 찾을 수 없음',
      );
    }
    return {
      id: row.id,
      status: row.status,
      nickname: row.nickname,
      notificationEnabled: row.notification_enabled,
      createdAt: row.created_at,
      phone: phone.rows[0] ? maskPhone(phone.rows[0].phone_e164) : null,
      identities: identities.rows.map((r) => r.provider),
      restriction: restriction ? { until: restriction.ends_at } : null,
      reconsentRequired: pending,
    };
  }

  async updateProfile(userId, { nickname, notificationEnabled }) {
    if (nickname === undefined && notificationEnabled === undefined) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'bad_request',
        '변경할 값이 없음',
      );
    }
    try {
      await this.database.query(
        `UPDATE profiles
            SET nickname = COALESCE($2, nickname),
                notification_enabled = COALESCE($3, notification_enabled),
                updated_at = now()
          WHERE user_id = $1`,
        [userId, nickname ?? null, notificationEnabled ?? null],
      );
    } catch (err) {
      rethrowConstraint(err, { profiles_nickname_ci_uq: nicknameTaken });
    }
    return this.getMe(userId);
  }

  async listCurrentPolicies() {
    const versions = await this.consents.currentVersions();
    return versions.map((v) => ({
      id: v.id,
      documentType: v.document_type,
      version: v.version,
      body: v.body,
      effectiveAt: v.effective_at,
      requiresReconsent: v.requires_reconsent,
    }));
  }

  async recordConsents(userId, consents) {
    await this.database.withTransaction((tx) =>
      this.consents.record(tx, userId, consents),
    );
    return { reconsentRequired: await this.consents.pendingReconsent(userId) };
  }
}
