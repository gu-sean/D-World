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
import { parseAdminPage, pickEnum } from '../common/pagination/admin-page.js';
import {
  idOf,
  oneOf,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import { definitionRules } from './challenges.validation.js';
import { ChallengesService } from './challenges.service.js';
import { ParticipationService } from './participation.service.js';
import { RewardPayoutService } from './reward-payout.service.js';
import { ScoringService } from './scoring.service.js';
import { SettlementService } from './settlement.service.js';
import { UserChallengesService } from './user-challenges.service.js';

// 모든 변경 요청에 reason(1~500자) 필요 (팀 문서 09 §0-4)
const reasonRule = () =>
  string({
    min: 1,
    max: 500,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
  });

/** 관리자 챌린지 API M51~M61, 변경 요청은 Idempotency-Key가 필요 */
@Controller('admin/v1')
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

  /** M53 */
  @Get('challenges')
  @Bind(Query())
  list(query) {
    const filters = validateBody(query, {
      categoryId: shortId({ optional: true }),
    });
    return this.challenges.listAdmin({
      publicationStatus: pickEnum(query, 'publicationStatus', [
        'draft',
        'review_pending',
        'public',
        'rejected',
        'hidden',
        'cancelled',
      ]),
      settlementStatus: query.settlementStatus || undefined,
      phase: pickEnum(query, 'phase', ['recruiting', 'ongoing', 'ended']),
      origin: pickEnum(query, 'origin', ['admin', 'user']),
      categoryId: filters.categoryId,
      paging: parseAdminPage(query, {
        'startDate,desc': 'start_date DESC, id DESC',
        'startDate,asc': 'start_date ASC, id ASC',
      }),
    });
  }

  /** M54 */
  @Get('challenges/:id')
  @Bind(Param('id'))
  get(id) {
    return this.challenges.getAdmin(idOf(id));
  }

  /** M51 */
  @Post('challenges')
  @Bind(Req(), Body())
  create(request, body) {
    const { reason, ...input } = validateBody(body, {
      ...definitionRules(false),
      reason: reasonRule(),
    });
    return this.challenges.createOfficial(
      request.auth.adminId,
      input,
      readIdempotencyKey(request),
      reason,
    );
  }

  /** M52: 필드 수정, 또는 { action: publish | hide | cancel, reason } */
  @Patch('challenges/:id')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  update(request, id, body) {
    const adminId = request.auth.adminId;
    const key = readIdempotencyKey(request);
    if (body && typeof body === 'object' && 'action' in body) {
      const { action, reason } = validateBody(body, {
        action: oneOf(['publish', 'hide', 'cancel']),
        reason: reasonRule(),
      });
      const challengeId = idOf(id);
      if (action === 'publish') {
        return this.challenges.publish(adminId, challengeId, key, reason);
      }
      if (action === 'hide') {
        return this.challenges.hide(adminId, challengeId, reason.trim(), key);
      }
      return this.participation.cancel(
        adminId,
        challengeId,
        reason.trim(),
        key,
      );
    }
    const { reason, ...patch } = validateBody(body, {
      ...definitionRules(true),
      reason: reasonRule(),
    });
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(['바꿀 항목이 없음']);
    }
    return this.challenges.updateOfficial(
      adminId,
      idOf(id),
      patch,
      key,
      reason,
    );
  }

  /** M55: 사용자 제작 챌린지 검수 (approved = 공개, rejected = 반려, hidden = 숨김) */
  @Post('challenges/:id/reviews')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  review(request, id, body) {
    const input = validateBody(body, {
      decision: oneOf(['approved', 'rejected', 'hidden']),
      reason: reasonRule(),
    });
    const key = readIdempotencyKey(request);
    if (input.decision === 'hidden') {
      return this.challenges.hide(
        request.auth.adminId,
        idOf(id),
        input.reason.trim(),
        key,
      );
    }
    return this.userChallenges.review(
      request.auth.adminId,
      idOf(id),
      {
        decision: input.decision === 'approved' ? 'approve' : 'reject',
        reason: input.reason.trim(),
      },
      key,
    );
  }

  /** M60 */
  @Get('challenges/:id/rankings')
  @Bind(Param('id'))
  rankings(id) {
    return this.scoring.getRankings(idOf(id));
  }

  /** 참가자의 일별 상태 (M61의 dailyMissionId를 고르는 데 사용) */
  @Get('challenges/:id/participants/:participationId/days')
  @Bind(Param('id'), Param('participationId'))
  participantDays(id, participationId) {
    return this.scoring.getParticipantDays(idOf(id), idOf(participationId));
  }

  /** M61: 실격 / 하루 제외 / 하루 복구. 실격 취소는 지원하지 않음 */
  @Post('challenges/:id/moderation-actions')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  async moderate(request, id, body) {
    const input = validateBody(body, {
      participationId: shortId(),
      action: oneOf(['disqualify', 'exclude_day', 'restore_day']),
      dailyMissionId: shortId({ optional: true }),
      reason: reasonRule(),
    });
    const adminId = request.auth.adminId;
    const key = readIdempotencyKey(request);
    const challengeId = idOf(id);
    const reason = input.reason.trim();
    if (input.action === 'disqualify') {
      if (input.dailyMissionId) {
        throw new BadRequestException([
          'dailyMissionId: disqualify에는 보낼 수 없음',
        ]);
      }
      await this.scoring.disqualify(
        adminId,
        challengeId,
        input.participationId,
        reason,
        key,
      );
    } else {
      if (!input.dailyMissionId) {
        throw new BadRequestException([
          'dailyMissionId: exclude_day·restore_day에는 필수',
        ]);
      }
      if (input.action === 'exclude_day') {
        await this.scoring.excludeDay(
          adminId,
          challengeId,
          input.participationId,
          input.dailyMissionId,
          { reason },
          key,
        );
      } else {
        await this.scoring.restoreDay(
          adminId,
          challengeId,
          input.participationId,
          input.dailyMissionId,
          reason,
          key,
        );
      }
    }
    return { ranking: (await this.scoring.getRankings(challengeId)).ranking };
  }

  // ── 정산 ──

  /** M56 */
  @Post('challenges/:id/settlement-runs')
  @HttpCode(201)
  @Bind(Req(), Param('id'), Body())
  createSettlement(request, id, body) {
    const { reason } = validateBody(body, { reason: reasonRule() });
    return this.settlement.createDraft(
      request.auth.adminId,
      idOf(id),
      readIdempotencyKey(request),
      reason.trim(),
    );
  }

  /** M57 */
  @Get('settlement-runs/:runId')
  @Bind(Param('runId'))
  async settlementDetail(runId) {
    const id = idOf(runId);
    return this.settlement.getRun(
      await this.settlement.challengeIdOfRun(id),
      id,
    );
  }

  /** M58 */
  @Post('settlement-runs/:runId/confirm')
  @HttpCode(200)
  @Bind(Req(), Param('runId'), Body())
  async confirmSettlement(request, runId, body) {
    const { reason } = validateBody(body, { reason: reasonRule() });
    const id = idOf(runId);
    return this.settlement.confirm(
      request.auth.adminId,
      await this.settlement.challengeIdOfRun(id),
      id,
      reason.trim(),
      readIdempotencyKey(request),
    );
  }

  /** M59 */
  @Post('settlement-runs/:runId/payments/retry')
  @HttpCode(202)
  @Bind(Req(), Param('runId'), Body())
  async retryPayments(request, runId, body) {
    const { reason } = validateBody(body, { reason: reasonRule() });
    const id = idOf(runId);
    const result = await this.payout.retryPayments(
      request.auth.adminId,
      await this.settlement.challengeIdOfRun(id),
      id,
      readIdempotencyKey(request),
      reason.trim(),
    );
    return {
      retriedCount: Object.values(result.payments ?? {}).reduce(
        (sum, count) => sum + count,
        0,
      ),
    };
  }
}
