import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { rethrowConstraint } from '../common/errors/constraint.js';
import { OBJECT_STORAGE } from '../media/storage/object-storage.js';
import { presignGetCached } from '../media/storage/presign-cache.js';
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
@Dependencies(
  DatabaseService,
  ConsentService,
  RestrictionService,
  OBJECT_STORAGE,
)
export class AccountsService {
  constructor(database, consents, restrictions, storage) {
    this.database = database;
    this.storage = storage;
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
          `SELECT u.id, u.status, p.nickname, p.notification_enabled, u.created_at,
                  p.age, p.height_cm, p.weight_kg, p.difficulty_reason,
                  p.difficulty_reviewed_at, dl.code AS recommended_difficulty_code
           FROM users u JOIN profiles p ON p.user_id = u.id
           LEFT JOIN difficulty_levels dl ON dl.id = p.recommended_difficulty_id
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
      age: row.age,
      heightCm: row.height_cm === null ? null : Number(row.height_cm),
      weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
      recommendedDifficultyCode: row.recommended_difficulty_code,
      difficultyReason: row.difficulty_reason,
      difficultyReviewedAt: row.difficulty_reviewed_at,
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
        `SELECT p.id, p.nickname, sv.stage_code, i.r2_object_key AS image_key
           FROM profiles pr
           JOIN user_pets p ON p.id = pr.representative_pet_id
           JOIN pet_stage_versions sv
             ON sv.species_version_id = p.species_version_id AND sv.stage_no = p.stage_no
           LEFT JOIN pet_stage_images i ON i.id = sv.image_id
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
    const representativePet = pet.rows[0];
    const representativeBadge = badge.rows[0];
    return {
      // 사용자 XP·레벨은 없앴다(022). 대신 펫에게 줄 수 있는 경험치(지갑)를 알려 준다
      petXpBalance: Number(
        (
          await this.database.query(
            'SELECT balance FROM pet_xp_wallets WHERE user_id = $1',
            [userId],
          )
        ).rows[0]?.balance ?? 0,
      ),
      availablePoints: Number(wallet.rows[0]?.available_points ?? 0),
      streakDays: streak.rows[0]?.current_success_days ?? 0,
      representativePet: representativePet
        ? {
            id: representativePet.id,
            nickname: representativePet.nickname,
            stageCode: representativePet.stage_code,
            imageUrl: representativePet.image_key
              ? await presignGetCached(this.storage, {
                  key: representativePet.image_key,
                  expiresInSec: 3600,
                })
              : null,
            stillUrl: representativePet.image_key
              ? await presignGetCached(this.storage, {
                  key: representativePet.image_key.replace(
                    /\.gif$/,
                    '.still.png',
                  ),
                  expiresInSec: 3600,
                })
              : null,
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

  async updateProfile(
    userId,
    { nickname, notificationEnabled, age, heightCm, weightKg },
  ) {
    if (
      nickname === undefined &&
      notificationEnabled === undefined &&
      age === undefined &&
      heightCm === undefined &&
      weightKg === undefined
    ) {
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
                age = COALESCE($4, age),
                height_cm = COALESCE($5, height_cm),
                weight_kg = COALESCE($6, weight_kg),
                updated_at = now()
          WHERE user_id = $1`,
        [
          userId,
          nickname ?? null,
          notificationEnabled ?? null,
          age ?? null,
          heightCm ?? null,
          weightKg ?? null,
        ],
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
