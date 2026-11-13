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
  array,
  idOf,
  integer,
  object,
  oneOf,
  string,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';
import { AdminAssetsService } from './admin-assets.service.js';

const UNLOCK_TYPES = [
  'none',
  'approved_mission_count',
  'category_approved_mission_count',
  'streak_milestone',
  'achievement_earned',
];
const STAGE_CODES = { 1: 'egg', 2: 'baby', 3: 'adult' };

const versionRules = () => ({
  name: string({ min: 1, max: 80, pattern: /\S/ }),
  description: string({ min: 1, max: 2000, optional: true }),
  personality: string({ min: 1, max: 2000, optional: true }),
  worldText: string({ min: 1, max: 4000, optional: true }),
  // categoryCode는 전역 인터셉터가 categoryId(ID)로 바꿔 줌
  categoryId: shortId(),
  unlockConditionType: oneOf(UNLOCK_TYPES),
  unlockTargetCount: integer({ min: 1, max: 1_000_000, optional: true }),
  unlockCategoryCode: string({ min: 1, max: 40, optional: true }),
  unlockAchievementId: shortId({ optional: true }),
  hatchMissionCount: integer({ min: 0, max: 1_000_000 }),
  stages: array(
    object({
      stageNo: integer({ min: 1, max: 3 }),
      minTotalXp: integer({ min: 0, max: 2_000_000_000 }),
      bonusBasisPoints: integer({ min: 0, max: 2000 }),
      imageAssetId: shortId(),
    }),
    { min: 3, max: 3 },
  ),
  status: oneOf(['draft', 'public']),
  effectiveAt: timestamp(),
  reason: string(REASON_RULE_OPTIONS),
});

/** 해금 조건·단계 구성을 DB CHECK 이전에 검사 */
function assertShape(input) {
  const errors = [];
  const type = input.unlockConditionType;
  const has = {
    count: input.unlockTargetCount !== undefined,
    category: input.unlockCategoryCode !== undefined,
    achievement: input.unlockAchievementId !== undefined,
  };
  const expected = {
    none: { count: false, category: false, achievement: false },
    approved_mission_count: {
      count: true,
      category: false,
      achievement: false,
    },
    category_approved_mission_count: {
      count: true,
      category: true,
      achievement: false,
    },
    streak_milestone: { count: true, category: false, achievement: false },
    achievement_earned: { count: false, category: false, achievement: true },
  }[type];
  const names = {
    count: 'unlockTargetCount',
    category: 'unlockCategoryCode',
    achievement: 'unlockAchievementId',
  };
  for (const key of Object.keys(expected)) {
    if (has[key] !== expected[key]) {
      errors.push(
        `${names[key]}: unlockConditionType=${type}일 때 ${expected[key] ? '필요함' : '넣을 수 없음'}`,
      );
    }
  }
  if (
    type === 'streak_milestone' &&
    ![7, 30, 100].includes(input.unlockTargetCount)
  ) {
    errors.push('unlockTargetCount: 7·30·100 중 하나여야 함');
  }
  const stages = [...input.stages].sort((a, b) => a.stageNo - b.stageNo);
  if (stages.map((s) => s.stageNo).join() !== '1,2,3') {
    errors.push('stages: stageNo 1·2·3이 하나씩 필요함');
  } else {
    if (stages[0].minTotalXp !== 0) errors.push('stages: 1단계 minTotalXp는 0');
    if (
      stages[1].minTotalXp <= 0 ||
      stages[2].minTotalXp <= stages[1].minTotalXp
    ) {
      errors.push('stages: minTotalXp는 단계가 오를수록 커야 함');
    }
    if (new Set(stages.map((s) => s.imageAssetId)).size !== 3) {
      errors.push('stages: 단계마다 다른 이미지여야 함');
    }
  }
  if (errors.length > 0) throw new BadRequestException(errors);
  return stages;
}

/** 관리자 펫 종류 API: 목록(M79), 새 종류(M80), 새 버전(M81) */
@Controller('admin/v1/pet-species')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService, AdminAssetsService)
export class AdminPetSpeciesController {
  constructor(database, mutation, assets) {
    this.database = database;
    this.mutation = mutation;
    this.assets = assets;
  }

  /** M79 */
  @Get()
  list() {
    return this.load(this.database);
  }

  /** M80: 단계 이미지 티켓(M84)에 정해 둔 ownerId가 새 종류 id가 됨 */
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
    const stages = assertShape(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'pet_species.create',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const id = await this.assets.ownerOfNewItem(
          tx,
          'pet_stage',
          stages.map((s) => s.imageAssetId),
        );
        const { rows } = await tx.query(
          'SELECT 1 FROM pet_species WHERE id = $1',
          [id],
        );
        if (rows.length > 0) {
          throw conflict(
            'ADMIN_STATE_CONFLICT',
            '이미 만들어진 종류예요. 새 버전으로 올려 주세요.',
          );
        }
        await tx.query(
          `INSERT INTO pet_species
             (id, code, name, description, status, created_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            input.code,
            input.name.trim(),
            input.description ?? null,
            input.status,
            adminId,
          ],
        );
        await this.insertVersion(tx, { adminId, speciesId: id, input, stages });
        const [view] = await this.load(tx, id);
        return {
          result: view,
          after: { id, code: input.code, status: input.status, versionNo: 1 },
        };
      },
    });
  }

  /** M81: 새 버전, 이미 키우는 펫은 자기 버전을 유지 */
  @Post(':speciesId/versions')
  @Bind(Req(), Param('speciesId'), Body())
  createVersion(request, speciesId, body) {
    const id = idOf(speciesId);
    const input = validateBody(body, versionRules());
    const stages = assertShape(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'pet_species.version',
      payload: { speciesId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT * FROM pet_species WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('species_not_found', '펫 종류를 찾을 수 없음');
        }
        if (rows[0].status === 'hidden') {
          throw conflict('ADMIN_STATE_CONFLICT', '숨긴 종류는 고칠 수 없어요.');
        }
        const versionNo = await this.insertVersion(tx, {
          adminId,
          speciesId: id,
          input,
          stages,
        });
        await tx.query(
          `UPDATE pet_species SET status = $2, updated_at = now() WHERE id = $1`,
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

  async insertVersion(tx, { adminId, speciesId, input, stages }) {
    let unlockCategoryId = null;
    if (input.unlockCategoryCode !== undefined) {
      const { rows } = await tx.query(
        'SELECT id FROM goal_categories WHERE code = $1',
        [input.unlockCategoryCode],
      );
      if (rows.length === 0) {
        throw new BadRequestException(['unlockCategoryCode: 알 수 없는 코드']);
      }
      unlockCategoryId = rows[0].id;
    }
    if (input.unlockAchievementId !== undefined) {
      const { rows } = await tx.query(
        'SELECT 1 FROM achievement_definitions WHERE id = $1',
        [input.unlockAchievementId],
      );
      if (rows.length === 0) {
        throw new BadRequestException(['unlockAchievementId: 없는 업적']);
      }
    }
    const imageIds = [];
    for (const stage of stages) {
      imageIds.push(
        await this.assets.useAsset(tx, {
          assetId: stage.imageAssetId,
          assetKind: 'pet_stage',
          ownerId: speciesId,
        }),
      );
    }
    const { rows: next } = await tx.query(
      `SELECT COALESCE(max(version_no), 0) + 1 AS next
         FROM pet_species_versions WHERE species_id = $1`,
      [speciesId],
    );
    const versionNo = next[0].next;
    const versionId = newId();
    await tx.query(
      `INSERT INTO pet_species_versions
         (id, species_id, version_no, name, description, personality, world_text,
          category_id, unlock_condition_type, unlock_target_count,
          unlock_category_id, unlock_achievement_id, hatch_mission_count,
          effective_at, created_by_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        versionId,
        speciesId,
        versionNo,
        input.name.trim(),
        input.description ?? null,
        input.personality ?? null,
        input.worldText ?? null,
        input.categoryId,
        input.unlockConditionType,
        input.unlockTargetCount ?? null,
        unlockCategoryId,
        input.unlockAchievementId ?? null,
        input.hatchMissionCount,
        input.effectiveAt,
        adminId,
      ],
    );
    // 단계 순서 검사 트리거가 앞 단계를 보므로 1단계부터 차례로 넣음
    for (const [index, stage] of stages.entries()) {
      await tx.query(
        `INSERT INTO pet_stage_versions
           (species_version_id, species_id, stage_no, stage_code, min_total_xp,
            bonus_basis_points, image_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          versionId,
          speciesId,
          stage.stageNo,
          STAGE_CODES[stage.stageNo],
          stage.minTotalXp,
          stage.bonusBasisPoints,
          imageIds[index],
        ],
      );
    }
    return versionNo;
  }

  /** 종류 전체(또는 하나)를 버전·단계·이미지 주소와 함께 읽음 */
  async load(db, onlyId = null) {
    const { rows: species } = await db.query(
      `SELECT id, code, status, created_at, updated_at FROM pet_species
        WHERE ($1::short_id IS NULL OR id = $1) ORDER BY created_at, id`,
      [onlyId],
    );
    const { rows: versions } = await db.query(
      `SELECT v.*, c.code AS unlock_category_code
         FROM pet_species_versions v
         LEFT JOIN goal_categories c ON c.id = v.unlock_category_id
        WHERE ($1::short_id IS NULL OR v.species_id = $1)
        ORDER BY v.species_id, v.version_no`,
      [onlyId],
    );
    const { rows: stageRows } = await db.query(
      `SELECT s.*, i.r2_object_key
         FROM pet_stage_versions s
         JOIN pet_stage_images i ON i.id = s.image_id
        WHERE ($1::short_id IS NULL OR s.species_id = $1)
        ORDER BY s.species_version_id, s.stage_no`,
      [onlyId],
    );
    const urls = new Map();
    for (const row of stageRows) {
      urls.set(row.image_id, await this.assets.viewUrl(row.r2_object_key));
    }
    const now = Date.now();
    return species.map((item) => {
      const own = versions
        .filter((v) => v.species_id === item.id)
        .map((v) => ({
          versionNo: v.version_no,
          name: v.name,
          description: v.description,
          personality: v.personality,
          worldText: v.world_text,
          categoryId: v.category_id,
          unlockConditionType: v.unlock_condition_type,
          unlockTargetCount: v.unlock_target_count,
          unlockCategoryCode: v.unlock_category_code,
          unlockAchievementId: v.unlock_achievement_id,
          hatchMissionCount: v.hatch_mission_count,
          effectiveAt: v.effective_at,
          stages: stageRows
            .filter((s) => s.species_version_id === v.id)
            .map((s) => ({
              stageNo: s.stage_no,
              stageCode: s.stage_code,
              minTotalXp: Number(s.min_total_xp),
              bonusBasisPoints: s.bonus_basis_points,
              imageAssetId: s.image_id,
              imageUrl: urls.get(s.image_id),
            })),
        }));
      const current = own
        .filter((v) => new Date(v.effectiveAt).getTime() <= now)
        .sort(
          (a, b) =>
            new Date(b.effectiveAt) - new Date(a.effectiveAt) ||
            b.versionNo - a.versionNo,
        )[0];
      return {
        id: item.id,
        code: item.code,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        currentVersionNo: current?.versionNo ?? null,
        versions: own,
      };
    });
  }
}
