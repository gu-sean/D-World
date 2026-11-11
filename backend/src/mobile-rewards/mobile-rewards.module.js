import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { MobileRewardsController } from './mobile-rewards.controller.js';
import { MobileRewardsService } from './mobile-rewards.service.js';

@Module({
  imports: [AchievementsModule],
  controllers: [MobileRewardsController],
  providers: [MobileRewardsService],
})
export class MobileRewardsModule {}
