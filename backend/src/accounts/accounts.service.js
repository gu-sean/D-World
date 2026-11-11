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
    const [account, phone, identities, restriction, pending, extras] =
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
        this.mobileExtras(userId),
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
      restriction: restriction
        ? { until: restriction.ends_at, endsAt: restriction.ends_at }
        : null,
      reconsentRequired: pending,
      // 모바일 클라이언트(08 Me) 키
      phoneLinked: Boolean(phone.rows[0]),
      providers: identities.rows.map((r) => r.provider),
      pendingConsents:
        Array.isArray(pending) && pending.length > 0
          ? (await this.listCurrentPolicies())
              .filter((p) => pending.includes(p.documentType))
              .map((p) => ({ ...p, isRequired: true }))
          : [],
      ...extras,
    };
  }

  /** 07 Me의 레벨·포인트·연속 달성·대표 펫·대표 배지 */
  async mobileExtras(userId) {
    const [xp, wallet, streak, pet, badge] = await Promise.all([
      this.database.query(
        `SELECT e.total_xp, e.level_no,
                (SELECT t.min_total_xp FROM user_level_thresholds t
                  WHERE t.policy_version_id = e.level_policy_version_id
                    AND t.level_no = e.level_no + 1) AS next_level_xp
           FROM user_experience e WHERE e.user_id = $1`,
        [userId],
      ),
      this.database.query(
        'SELECT available_points FROM point_wallets WHERE user_id = $1',
        [userId],
      ),
      this.database.query(
        'SELECT current_success_days FROM streak_states WHERE user_id = $1',
        [userId],
      ),
      this.database.query(
        `SELECT p.id, p.nickname, sv.stage_code
           FROM profiles pr
           JOIN user_pets p ON p.id = pr.representative_pet_id
           JOIN pet_stage_versions sv
             ON sv.species_version_id = p.species_version_id AND sv.stage_no = p.stage_no
          WHERE pr.user_id = $1`,
        [userId],
      ),
      this.database.query(
        `SELECT a.id AS achievement_id, v.title, v.rarity
           FROM profiles pr
           JOIN achievement_definitions a ON a.id = pr.representative_achievement_id
           JOIN user_achievements ua
             ON ua.achievement_id = a.id AND ua.user_id = pr.user_id AND ua.status = 'active'
           JOIN achievement_versions v ON v.id = ua.achievement_version_id
          WHERE pr.user_id = $1`,
        [userId],
      ),
    ]);
    const level = xp.rows[0];
    const representativePet = pet.rows[0];
    const representativeBadge = badge.rows[0];
    return {
      levelNo: level?.level_no ?? 1,
      totalXp: Number(level?.total_xp ?? 0),
      nextLevelXp:
        level?.next_level_xp === null || level?.next_level_xp === undefined
          ? null
          : Number(level.next_level_xp),
      availablePoints: Number(wallet.rows[0]?.available_points ?? 0),
      streakDays: streak.rows[0]?.current_success_days ?? 0,
      representativePet: representativePet
        ? {
            id: representativePet.id,
            nickname: representativePet.nickname,
            stageCode: representativePet.stage_code,
            imageUrl: null,
          }
        : null,
      representativeBadge: representativeBadge
        ? {
            achievementId: representativeBadge.achievement_id,
            title: representativeBadge.title,
            rarity: representativeBadge.rarity,
            badgeImageUrl: null,
          }
        : null,
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
    } catch (error) {
      rethrowConstraint(error, { profiles_nickname_ci_uq: nicknameTaken });
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
