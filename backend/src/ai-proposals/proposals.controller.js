import {
  array,
  boolean,
  dateString,
  idOf,
  integer,
  number,
  object,
  oneOf,
  string,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { MAX_STEPS_PER_GOAL } from '../goals/goals.constants.js';
import { VERIFICATION_METHODS } from '../missions/missions.constants.js';
import { MAX_PLAN_MISSIONS, PROPOSAL_STATUSES } from './proposals.constants.js';
import { ProposalsService } from './proposals.service.js';
import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import { parseLimit } from '../common/pagination/limit.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const title = () =>
  string({
    min: 1,
    max: 200,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
  });
// 빈 문자열은 값 삭제를 뜻함
const text = (max) => string({ min: 0, max, optional: true });

// 계획의 미션 한 건 = 실행 미션 한 행(날짜마다 따로). 카테고리·난이도를 생략하면 목표의 값
const missionSpec = object({
  title: title(),
  description: text(2000),
  categoryId: shortId({ optional: true }),
  difficultyId: shortId({ optional: true }),
  exerciseCode: oneOf(
    ['push_up', 'burpee', 'squat', 'lunge', 'plank', 'running'],
    { optional: true },
  ),
  verificationMethod: oneOf(VERIFICATION_METHODS),
  targetValue: number({ min: 0.01, max: 99_999_999.99, optional: true }),
  targetUnit: string({ min: 1, max: 20, pattern: /\S/, optional: true }),
  estimatedDurationSeconds: integer({ min: 1, max: 86_400, optional: true }),
  scheduledDate: dateString(),
  dueAt: timestamp({ optional: true }),
  isRequired: boolean({ optional: true }),
  memo: text(1000),
});

const stepSpec = object({
  title: title(),
  description: text(2000),
  dueDate: dateString(),
  missions: array(missionSpec, { max: MAX_PLAN_MISSIONS, optional: true }),
});

export const planSpec = object({
  steps: array(stepSpec, { max: MAX_STEPS_PER_GOAL, optional: true }),
  missions: array(missionSpec, { max: MAX_PLAN_MISSIONS, optional: true }),
});

@Controller('goals/:goalId/proposals')
@Dependencies(ProposalsService)
export class ProposalsController {
  constructor(proposals) {
    this.proposals = proposals;
  }

  @Get()
  @Bind(Req(), Param('goalId'), Query())
  list(request, goalId, query) {
    const filters = validateBody(query, {
      status: oneOf(PROPOSAL_STATUSES, { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    const limit = parseLimit(query, DEFAULT_LIMIT, MAX_LIMIT);
    return this.proposals.listProposals(request.auth.userId, idOf(goalId), {
      ...filters,
      limit,
    });
  }

  /** 사용자가 확인·수정한 계획 { plan: { steps?, missions? } }을 보내 수락 */
  @Post(':proposalId/accept')
  @HttpCode(200)
  @RequireActive()
  @Bind(Req(), Param('goalId'), Param('proposalId'), Body())
  accept(request, goalId, proposalId, body) {
    const { plan } = validateBody(body, { plan: planSpec });
    return this.proposals.acceptProposal(
      request.auth.userId,
      idOf(goalId),
      idOf(proposalId),
      plan,
    );
  }

  @Post(':proposalId/reject')
  @HttpCode(200)
  @Bind(Req(), Param('goalId'), Param('proposalId'))
  reject(request, goalId, proposalId) {
    return this.proposals.rejectProposal(
      request.auth.userId,
      idOf(goalId),
      idOf(proposalId),
    );
  }
}
