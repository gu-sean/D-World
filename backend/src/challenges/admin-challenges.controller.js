import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import { idOf, oneOf, uuid, validateBody } from '../common/validation.js';
import { definitionRules, limitOf, text } from './challenges.validation.js';
import { ChallengesService } from './challenges.service.js';
import { ParticipationService } from './participation.service.js';
import { RewardPayoutService } from './reward-payout.service.js';
import { ScoringService } from './scoring.service.js';
import { SettlementService } from './settlement.service.js';
import { UserChallengesService } from './user-challenges.service.js';

/** 관리자: 공식 챌린지 등록·수정·공개·숨김, 변경 요청은 Idempotency-Key가 필요 */
@Controller('admin/v1/challenges')
@AdminOnly()
@Dependencies(
  ChallengesService,
  ParticipationService,
  ScoringService,
  SettlementService,
  UserChallengesService,
  RewardPayoutService,
)
export class AdminChallengesController {
  constructor(
    challenges,
    participation,
    scoring,
    settlement,
    userChallenges,
    payout,
  ) {
    this.payout = payout;
    this.challenges = challenges;
    this.participation = participation;
    this.scoring = scoring;
    this.settlement = settlement;
    this.userChallenges = userChallenges;
  }

  /** 검수 대기열(오래된 순) */
  @Get('review-queue')
  @Bind(Query())
  reviewQueue(query) {
    return this.userChallenges.reviewQueue({ limit: limitOf(query) });
  }

  @Get()
  @Bind(Query())
  list(query) {
    const filters = validateBody(query, {
      status: oneOf(
        [
          'draft',
          'review_pending',
          'public',
          'rejected',
          'hidden',
          'cancelled',
        ],
        { optional: true },
      ),
    });
    return this.challenges.listAdmin({ ...filters, limit: limitOf(query) });
  }

  @Get(':id')
  @Bind(Param('id'))
  get(id) {
    return this.challenges.getAdmin(idOf(id));
  }

  @Post()
  @Bind(Req(), Body())
  create(req, body) {
    const input = validateBody(body, definitionRules(false));
    return this.challenges.createOfficial(
      req.auth.adminId,
      input,
      readIdempotencyKey(req),
    );
  }

  @Patch(':id')
  @Bind(Req(), Param('id'), Body())
  update(req, id, body) {
    const patch = validateBody(body, definitionRules(true));
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(['바꿀 항목이 없음']);
    }
    return this.challenges.updateOfficial(
      req.auth.adminId,
      idOf(id),
      patch,
      readIdempotencyKey(req),
    );
  }

  @Post(':id/publish')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  publish(req, id) {
    return this.challenges.publish(
      req.auth.adminId,
      idOf(id),
      readIdempotencyKey(req),
    );
  }

  @Post(':id/hide')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  hide(req, id, body) {
    const { reason } = validateBody(body, { reason: text(1000) });
    return this.challenges.hide(
      req.auth.adminId,
      idOf(id),
      reason.trim(),
      readIdempotencyKey(req),
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  cancel(req, id, body) {
    const { reason } = validateBody(body, { reason: text(1000) });
    return this.participation.cancel(
      req.auth.adminId,
      idOf(id),
      reason.trim(),
      readIdempotencyKey(req),
    );
  }

  @Get(':id/participants')
  @Bind(Param('id'))
  participants(id) {
    return this.scoring.listParticipants(idOf(id));
  }

  @Get(':id/participants/:participationId/days')
  @Bind(Param('id'), Param('participationId'))
  participantDays(id, participationId) {
    return this.scoring.getParticipantDays(idOf(id), idOf(participationId));
  }

  /** 실격은 최종이며 순위에서 빠진다(되돌릴 수 없음) */
  @Post(':id/participants/:participationId/disqualify')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Param('participationId'), Body())
  disqualify(req, id, participationId, body) {
    const { reason } = validateBody(body, { reason: text(1000) });
    return this.scoring.disqualify(
      req.auth.adminId,
      idOf(id),
      idOf(participationId),
      reason.trim(),
      readIdempotencyKey(req),
    );
  }

  @Post(':id/participants/:participationId/days/:dailyId/exclude')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Param('participationId'), Param('dailyId'), Body())
  excludeDay(req, id, participationId, dailyId, body) {
    const input = validateBody(body, {
      reason: text(1000),
      evidenceResultId: uuid({ optional: true }),
    });
    return this.scoring.excludeDay(
      req.auth.adminId,
      idOf(id),
      idOf(participationId),
      idOf(dailyId),
      { ...input, reason: input.reason.trim() },
      readIdempotencyKey(req),
    );
  }

  @Post(':id/participants/:participationId/days/:dailyId/restore')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Param('participationId'), Param('dailyId'), Body())
  restoreDay(req, id, participationId, dailyId, body) {
    const { reason } = validateBody(body, { reason: text(1000) });
    return this.scoring.restoreDay(
      req.auth.adminId,
      idOf(id),
      idOf(participationId),
      idOf(dailyId),
      reason.trim(),
      readIdempotencyKey(req),
    );
  }

  /** 사용자 개설 챌린지 검수: approve(공개) / reject(사유 필수) */
  @Post(':id/review')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  review(req, id, body) {
    const input = validateBody(body, {
      decision: oneOf(['approve', 'reject']),
      reason: text(1000, true),
    });
    if (input.decision === 'reject' && !input.reason?.trim()) {
      throw new BadRequestException(['reason: 반려에는 사유가 필요함']);
    }
    return this.userChallenges.review(
      req.auth.adminId,
      idOf(id),
      { decision: input.decision, reason: input.reason?.trim() },
      readIdempotencyKey(req),
    );
  }

  // ── 정산 ──

  @Get(':id/settlements')
  @Bind(Param('id'))
  settlements(id) {
    return this.settlement.listRuns(idOf(id));
  }

  @Get(':id/settlements/:runId')
  @Bind(Param('id'), Param('runId'))
  settlementDetail(id, runId) {
    return this.settlement.getRun(idOf(id), idOf(runId));
  }

  /** 종료 다음 날부터 정산 초안 생성(기존 초안은 새로 계산한 것으로 대체) */
  @Post(':id/settlements')
  @HttpCode(201)
  @Bind(Req(), Param('id'))
  createSettlement(req, id) {
    return this.settlement.createDraft(
      req.auth.adminId,
      idOf(id),
      readIdempotencyKey(req),
    );
  }

  @Post(':id/settlements/:runId/confirm')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Param('runId'), Body())
  confirmSettlement(req, id, runId, body) {
    const { reason } = validateBody(body, { reason: text(1000) });
    return this.settlement.confirm(
      req.auth.adminId,
      idOf(id),
      idOf(runId),
      reason.trim(),
      readIdempotencyKey(req),
    );
  }

  @Post(':id/settlements/:runId/retry-payments')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Param('runId'))
  retryPayments(req, id, runId) {
    return this.payout.retryPayments(
      req.auth.adminId,
      idOf(id),
      idOf(runId),
      readIdempotencyKey(req),
    );
  }
}
