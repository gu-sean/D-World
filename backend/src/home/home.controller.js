import {
  Bind,
  Controller,
  Dependencies,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { kstDate } from '../common/time/kst.js';
import { dateString, validateBody } from '../common/validation.js';
import { HomeService } from './home.service.js';

/** 읽기 전용이라 이용 제한 중에도 조회 가능 */
@Controller('home')
@Dependencies(HomeService)
export class HomeController {
  constructor(home) {
    this.home = home;
  }

  /** A29: date 생략 시 오늘(KST) */
  @Get()
  @Bind(Req(), Query())
  get(request, query) {
    const { date } = validateBody(query, {
      date: dateString({ optional: true }),
    });
    const today = kstDate();
    return this.home.getHome(request.auth.userId, date ?? today, today);
  }
}
