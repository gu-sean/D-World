import { newId } from '../common/ids.js';
import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  idOf,
  integer,
  oneOf,
  string,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';
import { AdminAssetsService } from './admin-assets.service.js';

const CONDITION_TYPES = [
  'first_goal_completed',
  'approved_mission_count',
  'category_approved_mission_count',
  'streak_milestone',
];
const MAX_REWARD = 1_000_000;

const versionRules = () => ({
  title: string({ min: 1, max: 160, pattern: /\S/ }),
  description: string({ min: 1, max: 2000, pattern: /\S/ }),
  rarity: oneOf(['common', 'rare', 'legendary']),
  conditionType: oneOf(CONDITION_TYPES),
  targetCount: integer({ min: 1, max: 1_000_000 }),
  // categoryCode는 전역 인터셉터가 categoryId(ID)로 바꿔 줌
  categoryId: shortId({ optional: true }),
  rewardPoints: integer({ min: 0, max: MAX_REWARD }),
  rewardUserXp: integer({ min: 0, max: MAX_REWARD }),
  rewardPetXp: integer({ min: 0, max: MAX_REWARD }),
  badgeAssetId: shortId(),
  status: oneOf(['draft', 'public']),
  effectiveAt: timestamp(),
  reason: string(REASON_RULE_OPTIONS),
});

/** DB CHECK와 같은 규칙을 먼저 검사해 필드별 오류로 돌려줌 */
function assertCondition(input) {
  const errors = [];
  const { conditionType, targetCount, categoryId } = input;
  if (conditionType === 'first_goal_completed' && targetCount !== 1) {
    errors.push('targetCount: first_goal_completed는 1이어야 함');
  }
  if (conditionType === 'category_approved_mission_count') {
    if (!categoryId) errors.push('categoryCode: 분야별 조건에는 필요함');
  } else if (categoryId) {
    errors.push('categoryCode: 분야별 조건에서만 쓸 수 있음');
  }
  if (conditionType === 'streak_milestone') {
    if (![7, 30, 100].includes(targetCount)) {
      errors.push('targetCount: streak_milestone은 7·30·100 중 하나여야 함');
    }
    if (
      input.rewardPoints !== 0 ||
      input.rewardUserXp !== 0 ||
      input.rewardPetXp !== 0
    ) {
      errors.push('reward*: streak_milestone은 보상이 0이어야 함');
    }
  }
  if (errors.length > 0) throw new BadRequestException(errors);
}

const versionView = (row, imageUrl) => ({
  versionNo: row.version_no,
  title: row.title,
  description: row.description,
  rarity: row.rarity,
  conditionType: row.condition_type,
  targetCount: row.target_count,
  categoryId: row.category_id,
  rewardPoints: row.reward_points,
  rewardUserXp: row.reward_user_xp,
  rewardPetXp: row.reward_pet_xp,
  badgeAssetId: row.badge_image_id,
  badgeImageUrl: imageUrl,
  effectiveAt: row.effective_at,
  createdAt: row.created_at,
});

/** 관리자 업적 API: 목록(M76), 새 업적(M77), 새 버전(M78) */
@Controller('admin/v1/achievements')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService, AdminAssetsService)
export class AdminAchievementsController {
  constructor(database, mutation, assets) {
    this.database = database;
    this.mutation = mutation;
    this.assets = assets;
  }

  /** M76 */
  @Get()
  list() {
    return this.load(this.database);
  }

  /** M77: 이미지 티켓(M84)에 정해 둔 ownerId가 새 업적 id가 됨 */
  @Post()
  @Bind(Req(), Body())
  create(request, body) {
    const input = validateBody(body, {
      code: string({
        min: 1,
        max: 80,
        pattern: /^[a-z][a-z0-9_]*$/,
        patternMessage: '소문자로 시작하는 소문자·숫자·밑줄만 가능',
      }),
      ...versionRules(),
    });
    assertCondition(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'achievement.create',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const id = await this.assets.ownerOfNewItem(tx, 'badge', [
          input.badgeAssetId,
        ]);
        const { rows } = await tx.query(
          'SELECT 1 FROM achievement_definitions WHERE id = $1',
          [id],
        );
        if (rows.length > 0) {
          throw conflict(
            'ADMIN_STATE_CONFLICT',
            '이미 만들어진 업적이에요. 새 버전으로 올려 주세요.',
          );
        }
        await tx.query(
          `INSERT INTO achievement_definitions
             (id, code, status, created_by_admin_id)
           VALUES ($1, $2, $3, $4)`,
          [id, input.code, input.status, adminId],
        );
        const created = await this.insertVersion(tx, {
          adminId,
          achievementId: id,
          input,
        });
        await this.requestBackfill(tx, adminId, id, created, input.status);
        const [view] = await this.load(tx, id);
        return {
          result: view,
          after: { id, code: input.code, status: input.status, versionNo: 1 },
        };
      },
    });
  }

  /** M78: 새 버전, 이전 버전과 이미 받은 배지는 그대로 */
  @Post(':achievementId/versions')
  @Bind(Req(), Param('achievementId'), Body())
  createVersion(request, achievementId, body) {
    const id = idOf(achievementId);
    const input = validateBody(body, versionRules());
    assertCondition(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'achievement.version',
      payload: { achievementId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT * FROM achievement_definitions WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('achievement_not_found', '업적을 찾을 수 없음');
        }
        if (rows[0].status === 'hidden') {
          throw conflict('ADMIN_STATE_CONFLICT', '숨긴 업적은 고칠 수 없어요.');
        }
        const { versionNo, versionId } = await this.insertVersion(tx, {
          adminId,
          achievementId: id,
          input,
        });
        await this.requestBackfill(
          tx,
          adminId,
          id,
          { versionId },
          input.status,
        );
        await tx.query(
          `UPDATE achievement_definitions SET status = $2, updated_at = now()
            WHERE id = $1`,
          [id, input.status],
        );
        const [view] = await this.load(tx, id);
        return {
          result: view,
          before: { status: rows[0].status },
          after: { status: input.status, versionNo },
        };
      },
    });
  }

  async insertVersion(tx, { adminId, achievementId, input }) {
    const imageId = await this.assets.useAsset(tx, {
      assetId: input.badgeAssetId,
      assetKind: 'badge',
      ownerId: achievementId,
    });
    const { rows } = await tx.query(
      `SELECT COALESCE(max(version_no), 0) + 1 AS next
         FROM achievement_versions WHERE achievement_id = $1`,
      [achievementId],
    );
    const versionNo = rows[0].next;
    const versionId = newId();
    await tx.query(
      `INSERT INTO achievement_versions
         (id, achievement_id, version_no, title, description, rarity,
          condition_type, target_count, category_id, reward_points,
          reward_user_xp, reward_pet_xp, badge_image_id, effective_at,
          created_by_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        versionId,
        achievementId,
        versionNo,
        input.title.trim(),
        input.description.trim(),
        input.rarity,
        input.conditionType,
        input.targetCount,
        input.categoryId ?? null,
        input.rewardPoints,
        input.rewardUserXp,
        input.rewardPetXp,
        imageId,
        input.effectiveAt,
        adminId,
      ],
    );
    return { versionNo, versionId };
  }

  /** 공개 버전이면 과거 활동 소급 평가를 요청(정기 작업이 배치로 처리, 새 버전마다 한 번) */
  async requestBackfill(tx, adminId, achievementId, { versionId }, status) {
    if (status !== 'public') return;
    await tx.query(
      `INSERT INTO achievement_backfill_runs
         (id, achievement_id, version_id, requested_by_admin_id)
       VALUES ($1, $2, $3, $4)`,
      [newId(), achievementId, versionId, adminId],
    );
  }

  /** 업적 전체(또는 하나)를 버전·배지 주소와 함께 읽음 */
  async load(db, onlyId = null) {
    const { rows: defs } = await db.query(
      `SELECT id, code, status, created_at, updated_at
         FROM achievement_definitions
        WHERE ($1::short_id IS NULL OR id = $1)
        ORDER BY created_at, id`,
      [onlyId],
    );
    const { rows: versions } = await db.query(
      `SELECT v.*, i.r2_object_key
         FROM achievement_versions v
         JOIN achievement_badge_images i ON i.id = v.badge_image_id
        WHERE ($1::short_id IS NULL OR v.achievement_id = $1)
        ORDER BY v.achievement_id, v.version_no`,
      [onlyId],
    );
    const urls = new Map();
    for (const row of versions) {
      urls.set(row.id, await this.assets.viewUrl(row.r2_object_key));
    }
    const now = Date.now();
    return defs.map((def) => {
      const own = versions
        .filter((v) => v.achievement_id === def.id)
        .map((v) => versionView(v, urls.get(v.id)));
      const current = own
        .filter((v) => new Date(v.effectiveAt).getTime() <= now)
        .sort(
          (a, b) =>
            new Date(b.effectiveAt) - new Date(a.effectiveAt) ||
            b.versionNo - a.versionNo,
        )[0];
      return {
        id: def.id,
        code: def.code,
        status: def.status,
        createdAt: def.created_at,
        updatedAt: def.updated_at,
        currentVersionNo: current?.versionNo ?? null,
        versions: own,
      };
    });
  }
}
