import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { ExperiencePetsModule } from '../experience-pets/experience-pets.module.js';
import { PointsModule } from '../points/points.module.js';
import { AdminChallengesController } from './admin-challenges.controller.js';
import {
  ChallengesController,
  MyChallengesController,
} from './challenges.controller.js';
import { ParticipationService } from './participation.service.js';
import { ChallengesService } from './challenges.service.js';
import { RewardPayoutService } from './reward-payout.service.js';
import { ScoringService } from './scoring.service.js';
import { UserChallengesService } from './user-challenges.service.js';
import { SettlementService } from './settlement.service.js';

/** 챌린지: 정의·공개, 참가·일별 미션, 일별 판정·순위, 정산·지급, 사용자 개설·검수 */
@Module({
  imports: [PointsModule, ExperiencePetsModule, AchievementsModule],
  controllers: [
    ChallengesController,
    MyChallengesController,
    AdminChallengesController,
  ],
  providers: [
    ChallengesService,
    ParticipationService,
    ScoringService,
    SettlementService,
    RewardPayoutService,
    UserChallengesService,
  ],
  exports: [
    ChallengesService,
    ParticipationService,
    ScoringService,
    SettlementService,
    RewardPayoutService,
  ],
})
export class ChallengesModule {}
