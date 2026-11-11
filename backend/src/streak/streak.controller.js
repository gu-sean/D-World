import {
  BadRequestException,
  Bind,
  Controller,
  Dependencies,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { addDays, kstDate } from '../common/time/kst.js';
import { dateString, validateBody } from '../common/validation.js';
import { DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS } from './streak.constants.js';
import { StreakService } from './streak.service.js';

/** 읽기 전용이라 이용 제한 중에도 조회 가능 */
@Controller('me/streak')
@Dependencies(StreakService)
export class StreakController {
  constructor(streak) {
    this.streak = streak;
  }

  @Get()
  @Bind(Req())
  summary(request) {
    return this.streak.getSummary(request.auth.userId);
  }

  @Get('days')
  @Bind(Req(), Query())
  days(request, query) {
    const filters = validateBody(query, {
      from: dateString({ optional: true }),
      to: dateString({ optional: true }),
    });
    const to = filters.to ?? kstDate();
    const from = filters.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
    if (from > to) {
      throw new BadRequestException(['from: to보다 늦을 수 없음']);
    }
    if (addDays(from, MAX_RANGE_DAYS) <= to) {
      throw new BadRequestException([
        `범위는 최대 ${MAX_RANGE_DAYS}일까지 조회할 수 있음`,
      ]);
    }
    return this.streak.listDays(request.auth.userId, { from, to });
  }
}
