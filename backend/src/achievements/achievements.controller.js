import {
  Bind,
  Controller,
  Dependencies,
  Get,
  Param,
  Patch,
  Body,
  Req,
} from '@nestjs/common';
import { uuid, validateBody } from '../common/validation.js';
import { AchievementsService } from './achievements.service.js';

@Controller()
@Dependencies(AchievementsService)
export class AchievementsController {
  constructor(achievements) {
    this.achievements = achievements;
  }

  @Get('me/achievements')
  @Bind(Req())
  list(req) {
    return this.achievements.list(this.achievements.database, req.auth.userId);
  }

  @Get('me/achievements/:id')
  @Bind(Req(), Param('id'))
  getOne(req, id) {
    const { achievementId } = validateBody(
      { achievementId: id },
      {
        achievementId: uuid(),
      },
    );
    return this.achievements.getProgress(
      this.achievements.database,
      req.auth.userId,
      achievementId,
    );
  }

  @Patch('me/profile/representative-achievement')
  @Bind(Req(), Body())
  setRepresentative(req, body) {
    // null·누락 모두 해제, uuid면 해당 업적으로 설정(소유·활성 검증은 DB 트리거)
    const { achievementId } = validateBody(body, {
      achievementId: uuid({ optional: true }),
    });
    return this.achievements.setRepresentative(
      this.achievements.database,
      req.auth.userId,
      achievementId ?? null,
    );
  }
}
