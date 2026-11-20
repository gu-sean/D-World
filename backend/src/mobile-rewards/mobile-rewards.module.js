import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { MediaModule } from '../media/media.module.js';
import { MobileRewardsController } from './mobile-rewards.controller.js';
import { MobileRewardsService } from './mobile-rewards.service.js';

@Module({
  // MediaModule: 업적 배지 이미지(관리자가 올린 R2 객체)의 임시 URL을 만들 때 OBJECT_STORAGE를 씀
  imports: [AchievementsModule, MediaModule],
  controllers: [MobileRewardsController],
  providers: [MobileRewardsService],
})
export class MobileRewardsModule {}
