import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import { AppException } from '../common/errors/app-exception.js';
import {
  idOf,
  oneOf,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import { PHASES } from './challenges.constants.js';
import { limitOf } from './challenges.validation.js';
import { ChallengesService } from './challenges.service.js';
import { MobileChallengesService } from './mobile-challenges.service.js';
import { ParticipationService } from './participation.service.js';
import { ScoringService } from './scoring.service.js';
import { UserChallengesService } from './user-challenges.service.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';

const adminOnly = () =>
  new AppException(
    HttpStatus.FORBIDDEN,
    'challenge_admin_only',
    '챌린지는 관리자만 만들 수 있어요',
  );

/** 사용자: 공개된 챌린지 탐색과 참여 (열람은 이용 제한 중에도 가능) */
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
      // 08 A100: 앱은 분야를 code로 보낸다 (exercise·study·lifestyle)
      categoryCode: string({ min: 1, max: 32, optional: true }),
      // 08 A100: 모집 중이고 시작까지 2일 이하인 것만
      closingSoon: oneOf(['true', 'false'], { optional: true }),
      // 예전 앱 호환용으로 받기만 한다: 목록은 항상 관리자가 만든 챌린지뿐
      origin: oneOf(['admin', 'user'], { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    return this.challenges.listPublic(request.auth.userId, {
      ...filters,
      origin: 'admin',
      limit: limitOf(query),
    });
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.challenges.getPublic(request.auth.userId, idOf(id));
  }

  // 챌린지는 관리자만 만들고 관리한다 (팀 결정). 회원은 참여·포기만 한다.
  // 예전 회원 개설 경로(개설·수정·검수 신청)는 남겨 두되 항상 403으로 막는다.
  @Post()
  create() {
    throw adminOnly();
  }

  @Patch(':id')
  update() {
    throw adminOnly();
  }

  @Post(':id/submit')
  submit() {
    throw adminOnly();
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
