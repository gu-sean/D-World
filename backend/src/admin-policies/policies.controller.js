import {
  array,
  boolean,
  idOf,
  integer,
  jsonObject,
  object,
  oneOf,
  string,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { CatalogService } from './catalog.service.js';
import { GrowthPoliciesService } from './growth-policies.service.js';
import { RewardPoliciesService } from './reward-policies.service.js';
import { assertRules } from './verification-rules.js';
import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import { parseLimit } from '../common/pagination/limit.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_POINTS = 1_000_000;
const MAX_XP = 1_000_000_000_000;
const MAX_LEVELS = 100;

// 보상표·인증 기준 목록은 { items } 없이 배열, 월 한도·스트릭 마일스톤·레벨 정책은 { items } (관리자 웹 형식)
const unwrapItems = (result) => result.items;
const reasonRule = () =>
  string({
    min: 1,
    max: 500,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
  });
const codeRule = () =>
  string({
    min: 1,
    max: 40,
    pattern: /^[a-z][a-z0-9_]*$/,
    patternMessage: '영문 소문자로 시작하고 소문자·숫자·밑줄만 사용',
  });
const nameRule = (optional = false) =>
  string({
    min: 1,
    max: 80,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    optional,
  });
const orderRule = (optional = false) =>
  integer({ min: 0, max: 10_000, optional });
const pointsRule = () => integer({ min: 0, max: MAX_POINTS });
const effectiveAtRule = () => timestamp({ optional: true });

const thresholdRule = object({
  levelNo: integer({ min: 1, max: MAX_LEVELS }),
  minTotalXp: integer({ min: 0, max: MAX_XP }),
});
const levelPolicyRule = () => ({
  thresholds: array(thresholdRule, { min: 1, max: MAX_LEVELS }),
  effectiveAt: effectiveAtRule(),
});

/**
 * 관리자 핵심 정책 API, 변경 요청은 Idempotency-Key 필수
 * 정책은 추가 전용 버전(PATCH/DELETE 없음), 시행 시각은 지금 이후만 허용
 */
@Controller('admin/v1')
@AdminOnly()
@Dependencies(CatalogService, RewardPoliciesService, GrowthPoliciesService)
export class PoliciesController {
  constructor(catalogs, rewards, growth) {
    this.catalogs = catalogs;
    this.rewards = rewards;
    this.growth = growth;
  }

  // ── 카테고리·난이도 (M45~M50) ──

  @Get('goal-categories')
  listCategories() {
    return this.catalogs.listCatalog('categories');
  }

  @Post('goal-categories')
  @Bind(Req(), Body())
  createCategory(request, body) {
    return this.createCatalog(request, 'categories', body);
  }

  @Patch('goal-categories/:id')
  @Bind(Req(), Param('id'), Body())
  updateCategory(request, id, body) {
    return this.updateCatalog(request, 'categories', id, body);
  }

  @Get('difficulty-levels')
  listDifficulties() {
    return this.catalogs.listCatalog('difficulties');
  }

  @Post('difficulty-levels')
  @Bind(Req(), Body())
  createDifficulty(request, body) {
    return this.createCatalog(request, 'difficulties', body);
  }

  @Patch('difficulty-levels/:id')
  @Bind(Req(), Param('id'), Body())
  updateDifficulty(request, id, body) {
    return this.updateCatalog(request, 'difficulties', id, body);
  }

  createCatalog(request, kind, body) {
    const { reason, ...input } = validateBody(body, {
      code: codeRule(),
      name: nameRule(),
      displayOrder: orderRule(),
      reason: reasonRule(),
    });
    return this.catalogs.createCatalog(
      request.auth.adminId,
      kind,
      input,
      readIdempotencyKey(request),
      reason,
    );
  }

  updateCatalog(request, kind, id, body) {
    const { reason, ...patch } = validateBody(body, {
      name: nameRule(true),
      displayOrder: orderRule(true),
      isActive: boolean({ optional: true }),
      reason: reasonRule(),
    });
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(['바꿀 항목이 없음']);
    }
    return this.catalogs.updateCatalog(
      request.auth.adminId,
      kind,
      idOf(id),
      patch,
      readIdempotencyKey(request),
      reason,
    );
  }

  // ── 보상표 (M74~M75) ──

  @Get('mission-reward-rates')
  @Bind(Query())
  listRewardRates(query) {
    const filters = validateBody(query, {
      categoryId: shortId({ optional: true }),
      difficultyId: shortId({ optional: true }),
    });
    return this.rewards
      .listRewardRates({
        ...filters,
        limit: parseLimit(query, DEFAULT_LIMIT, MAX_LIMIT),
      })
      .then(unwrapItems);
  }

  @Post('mission-reward-rates')
  @Bind(Req(), Body())
  createRewardRate(request, body) {
    const input = validateBody(body, {
      categoryId: shortId(),
      difficultyId: shortId(),
      points: pointsRule(),
      userXp: integer({ min: 0, max: MAX_POINTS }),
      petXp: integer({ min: 0, max: MAX_POINTS }),
      effectiveAt: effectiveAtRule(),
      reason: reasonRule(),
    });
    return this.rewards.createRewardRate(
      request.auth.adminId,
      input,
      readIdempotencyKey(request),
    );
  }

  // ── 판정 기준 (M36~M37) ──

  @Get('verification-criteria')
  @Bind(Query())
  listCriteria(query) {
    const filters = validateBody(query, {
      categoryId: shortId({ optional: true }),
      method: oneOf(['camera', 'sensor'], { optional: true }),
    });
    return this.rewards
      .listCriteria({
        categoryId: filters.categoryId,
        verificationMethod: filters.method,
        limit: parseLimit(query, DEFAULT_LIMIT, MAX_LIMIT),
      })
      .then(unwrapItems);
  }

  @Post('verification-criteria')
  @Bind(Req(), Body())
  createCriteria(request, body) {
    const input = validateBody(body, {
      categoryId: shortId(),
      verificationMethod: oneOf(['camera', 'sensor']),
      rules: jsonObject(),
      effectiveAt: effectiveAtRule(),
      reason: reasonRule(),
    });
    assertRules(input.rules);
    return this.rewards.createCriteria(
      request.auth.adminId,
      input,
      readIdempotencyKey(request),
    );
  }

  // ── 스트릭 마일스톤 금액 (M82~M83) ──

  @Get('streak-milestone-policies')
  listStreakMilestones() {
    return this.growth.listStreakMilestones();
  }

  @Post('streak-milestone-policies')
  @Bind(Req(), Body())
  createStreakMilestone(request, body) {
    const raw = validateBody(body, {
      targetSuccessDays: integer(),
      points: pointsRule(),
      userXp: integer({ min: 0, max: MAX_POINTS }),
      petXp: integer({ min: 0, max: MAX_POINTS }),
      effectiveAt: effectiveAtRule(),
      reason: reasonRule(),
    });
    if (![7, 30, 100].includes(raw.targetSuccessDays)) {
      throw new BadRequestException([
        'targetSuccessDays: 7, 30, 100 중 하나여야 함',
      ]);
    }
    return this.growth.createStreakMilestone(
      request.auth.adminId,
      { ...raw, targetDays: raw.targetSuccessDays },
      readIdempotencyKey(request),
    );
  }

  // ── 월간 포인트 한도 (M72~M73) ──

  @Get('point-cap-policies')
  listMonthlyCaps() {
    return this.growth.listMonthlyCaps();
  }

  @Post('point-cap-policies')
  @Bind(Req(), Body())
  createMonthlyCap(request, body) {
    const input = validateBody(body, {
      effectiveMonth: string({
        pattern: /^\d{4}-(0[1-9]|1[0-2])-01$/,
        patternMessage: '매월 1일(YYYY-MM-01)이어야 함',
      }),
      monthlyLimitPoints: integer({ min: 0, max: 1_000_000 }),
      reason: reasonRule(),
    });
    return this.growth.createMonthlyCap(
      request.auth.adminId,
      { ...input, limitPoints: input.monthlyLimitPoints },
      readIdempotencyKey(request),
    );
  }

  // ── 사용자·펫 레벨 정책 ──

  @Get('policies/user-levels')
  listUserLevels() {
    return this.growth.listLevelPolicies('user-levels');
  }

  @Post('policies/user-levels')
  @Bind(Req(), Body())
  createUserLevels(request, body) {
    return this.growth.createLevelPolicy(
      request.auth.adminId,
      'user-levels',
      validateBody(body, levelPolicyRule()),
      readIdempotencyKey(request),
    );
  }

  @Get('policies/pet-levels')
  listPetLevels() {
    return this.growth.listLevelPolicies('pet-levels');
  }

  @Post('policies/pet-levels')
  @Bind(Req(), Body())
  createPetLevels(request, body) {
    return this.growth.createLevelPolicy(
      request.auth.adminId,
      'pet-levels',
      validateBody(body, levelPolicyRule()),
      readIdempotencyKey(request),
    );
  }
}
