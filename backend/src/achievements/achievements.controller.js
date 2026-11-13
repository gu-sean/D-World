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
import { shortId, validateBody } from '../common/validation.js';
import { AchievementsService } from './achievements.service.js';

@Controller()
@Dependencies(AchievementsService)
export class AchievementsController {
  constructor(achievements) {
    this.achievements = achievements;
  }

  @Get('me/achievements')
  @Bind(Req())
  list(request) {
    return this.achievements.list(
      this.achievements.database,
      request.auth.userId,
    );
  }

  @Get('me/achievements/:id')
  @Bind(Req(), Param('id'))
  getOne(request, id) {
    const { achievementId } = validateBody(
      { achievementId: id },
      {
        achievementId: shortId(),
      },
    );
    return this.achievements.getProgress(
      this.achievements.database,
      request.auth.userId,
      achievementId,
    );
  }

  @Patch('me/profile/representative-achievement')
  @Bind(Req(), Body())
  setRepresentative(request, body) {
    // null·누락 모두 해제, ID면 해당 업적으로 설정(소유·활성 검증은 DB 트리거)
    const { achievementId } = validateBody(body, {
      achievementId: shortId({ optional: true }),
    });
    return this.achievements.setRepresentative(
      this.achievements.database,
      request.auth.userId,
      achievementId ?? null,
    );
  }
}
