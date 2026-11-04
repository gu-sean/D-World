import { Module } from '@nestjs/common';
import { ExperiencePetsModule } from '../experience-pets/experience-pets.module.js';
import { PointsModule } from '../points/points.module.js';
import { AchievementsController } from './achievements.controller.js';
import { AchievementsService } from './achievements.service.js';

/** 판정·목표·스트릭·챌린지 모듈이 import해서 evaluate()를 호출 */
@Module({
  imports: [PointsModule, ExperiencePetsModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
