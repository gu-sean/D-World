import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { ExperiencePetsModule } from '../experience-pets/experience-pets.module.js';
import { PointsModule } from '../points/points.module.js';
import { StreakController } from './streak.controller.js';
import { StreakService } from './streak.service.js';

/** 판정 반영(VerificationModule)과 정기 작업(JobsModule)이 import해서 StreakService를 호출 */
@Module({
  imports: [PointsModule, AchievementsModule, ExperiencePetsModule],
  controllers: [StreakController],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
