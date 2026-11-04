import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';
import { ReferenceController } from './reference.controller.js';
import { StepsService } from './steps.service.js';

/** 판정(3-C)·미션이 import해서 GoalsService.reevaluateStep을 호출 */
@Module({
  imports: [AchievementsModule],
  controllers: [GoalsController, ReferenceController],
  providers: [GoalsService, StepsService],
  exports: [GoalsService, StepsService],
})
export class GoalsModule {}
