import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module.js';
import { MissionsController } from './missions.controller.js';
import { MissionsService } from './missions.service.js';
import { RewardResolver } from './reward-resolver.js';

/** 판정(3-C)·AI 제안 수락(3-B-4)이 import해서 RewardResolver와 미션 조회를 재사용 */
@Module({
  imports: [GoalsModule],
  controllers: [MissionsController],
  providers: [MissionsService, RewardResolver],
  exports: [MissionsService, RewardResolver],
})
export class MissionsModule {}
