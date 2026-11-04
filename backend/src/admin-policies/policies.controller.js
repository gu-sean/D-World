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
  uuid,
  validateBody,
} from '../common/validation.js';
import { CatalogService } from './catalog.service.js';
import { GrowthPoliciesService } from './growth-policies.service.js';
import { PolicyReadinessService } from './policy-readiness.service.js';
import { RewardPoliciesService } from './reward-policies.service.js';
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_POINTS = 1_000_000;
const MAX_XP = 1_000_000_000_000;
const MAX_LEVELS = 100;

const listLimit = (query) => {
  if (query.limit === undefined) return DEFAULT_LIMIT;
  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
  }
  return limit;
};
const catalogKind = (kind) =>
  validateBody({ kind }, { kind: oneOf(['categories', 'difficulties']) }).kind;

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
@Dependencies(
  CatalogService,
  RewardPoliciesService,
  GrowthPoliciesService,
  PolicyReadinessService,
)
export class PoliciesController {
  constructor(catalogs, rewards, growth, readiness) {
    this.catalogs = catalogs;
    this.rewards = rewards;
    this.growth = growth;
    this.readinessService = readiness;
  }

  // ── 카테고리·난이도 ──

  @Get('catalogs/:kind')
  @Bind(Param('kind'))
  listCatalog(kind) {
    return this.catalogs.listCatalog(catalogKind(kind));
  }

  @Post('catalogs/:kind')
  @Bind(Req(), Param('kind'), Body())
  createCatalog(req, kind, body) {
    const input = validateBody(body, {
      code: codeRule(),
      name: nameRule(),
      displayOrder: orderRule(),
    });
    return this.catalogs.createCatalog(
      req.auth.adminId,
      catalogKind(kind),
      input,
      readIdempotencyKey(req),
    );
  }

  @Patch('catalogs/:kind/:id')
  @Bind(Req(), Param('kind'), Param('id'), Body())
  updateCatalog(req, kind, id, body) {
    const patch = validateBody(body, {
      name: nameRule(true),
      displayOrder: orderRule(true),
      isActive: boolean({ optional: true }),
    });
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(['바꿀 항목이 없음']);
    }
    return this.catalogs.updateCatalog(
      req.auth.adminId,
      catalogKind(kind),
      idOf(id),
      patch,
      readIdempotencyKey(req),
    );
  }

  // ── 보상표 ──

  @Get('policies/reward-rates')
  @Bind(Query())
  listRewardRates(query) {
    const filters = validateBody(query, {
      categoryId: uuid({ optional: true }),
      difficultyId: uuid({ optional: true }),
    });
    return this.rewards.listRewardRates({
      ...filters,
      limit: listLimit(query),
    });
  }

  @Post('policies/reward-rates')
  @Bind(Req(), Body())
  createRewardRate(req, body) {
    const input = validateBody(body, {
      categoryId: uuid(),
      difficultyId: uuid(),
      points: pointsRule(),
      userXp: integer({ min: 0, max: MAX_POINTS }),
      petXp: integer({ min: 0, max: MAX_POINTS }),
      effectiveAt: effectiveAtRule(),
    });
    return this.rewards.createRewardRate(
      req.auth.adminId,
      input,
      readIdempotencyKey(req),
    );
  }

  // ── 판정 기준 ──

  @Get('policies/criteria')
  @Bind(Query())
  listCriteria(query) {
    const filters = validateBody(query, {
      categoryId: uuid({ optional: true }),
      verificationMethod: oneOf(['camera', 'sensor'], { optional: true }),
    });
    return this.rewards.listCriteria({ ...filters, limit: listLimit(query) });
  }

  @Post('policies/criteria')
  @Bind(Req(), Body())
  createCriteria(req, body) {
    const input = validateBody(body, {
      categoryId: uuid(),
      verificationMethod: oneOf(['camera', 'sensor']),
      rules: jsonObject(),
      effectiveAt: effectiveAtRule(),
    });
    return this.rewards.createCriteria(
      req.auth.adminId,
      input,
      readIdempotencyKey(req),
    );
  }

  // ── 스트릭 마일스톤 금액 ──

  @Get('policies/streak-milestones')
  listStreakMilestones() {
    return this.growth.listStreakMilestones();
  }

  @Post('policies/streak-milestones')
  @Bind(Req(), Body())
  createStreakMilestone(req, body) {
    const raw = validateBody(body, {
      targetDays: integer(),
      points: pointsRule(),
      effectiveAt: effectiveAtRule(),
    });
    if (![7, 30, 100].includes(raw.targetDays)) {
      throw new BadRequestException(['targetDays: 7, 30, 100 중 하나여야 함']);
    }
    return this.growth.createStreakMilestone(
      req.auth.adminId,
      raw,
      readIdempotencyKey(req),
    );
  }

  // ── 월간 포인트 한도 ──

  @Get('policies/monthly-caps')
  listMonthlyCaps() {
    return this.growth.listMonthlyCaps();
  }

  @Post('policies/monthly-caps')
  @Bind(Req(), Body())
  createMonthlyCap(req, body) {
    const input = validateBody(body, {
      effectiveMonth: string({
        pattern: /^\d{4}-(0[1-9]|1[0-2])-01$/,
        patternMessage: '매월 1일(YYYY-MM-01)이어야 함',
      }),
      limitPoints: integer({ min: 0, max: 100_000_000 }),
    });
    return this.growth.createMonthlyCap(
      req.auth.adminId,
      input,
      readIdempotencyKey(req),
    );
  }

  // ── 사용자·펫 레벨 정책 ──

  @Get('policies/user-levels')
  listUserLevels() {
    return this.growth.listLevelPolicies('user-levels');
  }

  @Post('policies/user-levels')
  @Bind(Req(), Body())
  createUserLevels(req, body) {
    return this.growth.createLevelPolicy(
      req.auth.adminId,
      'user-levels',
      validateBody(body, levelPolicyRule()),
      readIdempotencyKey(req),
    );
  }

  @Get('policies/pet-levels')
  listPetLevels() {
    return this.growth.listLevelPolicies('pet-levels');
  }

  @Post('policies/pet-levels')
  @Bind(Req(), Body())
  createPetLevels(req, body) {
    return this.growth.createLevelPolicy(
      req.auth.adminId,
      'pet-levels',
      validateBody(body, levelPolicyRule()),
      readIdempotencyKey(req),
    );
  }

  // ── 서비스 시작 준비 상태 ──

  @Get('policies/readiness')
  readiness() {
    return this.readinessService.readiness();
  }
}
