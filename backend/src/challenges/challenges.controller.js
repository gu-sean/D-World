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
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import {
  idOf,
  oneOf,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import { PHASES } from './challenges.constants.js';
import { limitOf, userDefinitionRules } from './challenges.validation.js';
import { ChallengesService } from './challenges.service.js';
import { MobileChallengesService } from './mobile-challenges.service.js';
import { fromMobileChallengeInput } from './mobile-challenges.service.js';
import { ParticipationService } from './participation.service.js';
import { ScoringService } from './scoring.service.js';
import { UserChallengesService } from './user-challenges.service.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';

/** 사용자: 공개된 챌린지 탐색 (열람은 이용 제한 중에도 가능) */
@Controller('challenges')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(
  ChallengesService,
  ParticipationService,
  ScoringService,
  UserChallengesService,
)
export class ChallengesController {
  constructor(challenges, participation, scoring, userChallenges) {
    this.challenges = challenges;
    this.participation = participation;
    this.scoring = scoring;
    this.userChallenges = userChallenges;
  }

  @Get()
  @Bind(Req(), Query())
  list(request, query) {
    const filters = validateBody(query, {
      phase: oneOf(PHASES, { optional: true }),
      categoryId: shortId({ optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    return this.challenges.listPublic(request.auth.userId, {
      ...filters,
      limit: limitOf(query),
    });
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.challenges.getPublic(request.auth.userId, idOf(id));
  }

  /** 챌린지 개설(초안). 보상 없음, 공개는 검수 신청 필요 */
  @Post()
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Body())
  create(request, body) {
    const input = validateBody(
      fromMobileChallengeInput(body),
      userDefinitionRules(),
    );
    return this.userChallenges.createDraft(request.auth.userId, input);
  }

  @Patch(':id')
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  update(request, id, body) {
    const patch = validateBody(body, userDefinitionRules(true));
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(['바꿀 항목이 없음']);
    }
    return this.userChallenges.update(request.auth.userId, idOf(id), patch);
  }

  @Post(':id/submit')
  @RequireActive()
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  submit(request, id) {
    return this.userChallenges.submit(request.auth.userId, idOf(id));
  }

  /** 시작일 전까지 참가, 이용 제한·재동의 필요 계정은 불가. 이미 참가했으면 같은 참가를 돌려줌 */
  @Post(':id/join')
  @Idempotent()
  @RequireActive()
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  join(request, id) {
    return this.participation.join(request.auth.userId, idOf(id));
  }

  /** 포기는 이용 제한 중에도 가능 */
  @Post(':id/leave')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  leave(request, id) {
    return this.participation.leave(request.auth.userId, idOf(id));
  }

  @Get(':id/me')
  @Bind(Req(), Param('id'))
  mine(request, id) {
    return this.participation.getMine(request.auth.userId, idOf(id));
  }

  /** 전체 순위(진행 중에는 잠정값), 상위 limit명과 내 순위 */
  @Get(':id/ranking')
  @Bind(Req(), Param('id'), Query())
  ranking(request, id, query) {
    return this.scoring.ranking(request.auth.userId, idOf(id), {
      limit: limitOf(query),
    });
  }
}

@Controller('me/challenges')
@Dependencies(
  ParticipationService,
  UserChallengesService,
  MobileChallengesService,
)
export class MyChallengesController {
  constructor(participation, userChallenges, mobile) {
    this.participation = participation;
    this.userChallenges = userChallenges;
    this.mobile = mobile;
  }

  /** 내가 개설한 챌린지(모든 상태)와 마지막 검수 결과 */
  @Get('created')
  @Bind(Req(), Query())
  created(request, query) {
    return this.userChallenges.listMine(request.auth.userId, {
      limit: limitOf(query),
    });
  }

  /** 모바일 A104: MyChallenge 배열 (status 필터) */
  @Get()
  @Bind(Req(), Query())
  list(request, query) {
    const { status } = validateBody(query, {
      status: oneOf(
        ['enrolled', 'withdrawn', 'disqualified', 'completed', 'failed'],
        { optional: true },
      ),
    });
    return this.mobile.list(request.auth.userId, { status });
  }
}
