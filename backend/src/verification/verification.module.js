import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { ExperiencePetsModule } from '../experience-pets/experience-pets.module.js';
import { GoalsModule } from '../goals/goals.module.js';
import { MediaModule } from '../media/media.module.js';
import { PointsModule } from '../points/points.module.js';
import { ChallengesModule } from '../challenges/challenges.module.js';
import { StreakModule } from '../streak/streak.module.js';
import { AdminVerificationsController } from './review/admin-verifications.controller.js';
import { AdminReviewService } from './review/admin-review.service.js';
import { AiIngestController } from './ai/ai-ingest.controller.js';
import {
  AdminAppealsController,
  AppealsController,
} from './review/appeals.controller.js';
import { AppealsService } from './review/appeals.service.js';
import { AiDispatchService } from './ai/ai-dispatch.service.js';
import { aiDispatcherProvider } from './ai/ai-dispatcher.js';
import { AiIngestService } from './ai/ai-ingest.service.js';
import { DecisionService } from './decision.service.js';
import { MissionOutcomeNotifier } from './mission-outcome.notifier.js';
import { RecordsController } from './records/records.controller.js';
import { RecordsService } from './records/records.service.js';

/**
 * 수행 회차와 판정 반영: 모든 판정은 DecisionService.applyDecision을 거치고,
 * 이의 제기도 같은 함수 호출. 스트릭·챌린지 점수는 판정 반영 시 직접 호출됨
 */
@Module({
  imports: [
    MediaModule,
    PointsModule,
    ExperiencePetsModule,
    AchievementsModule,
    GoalsModule,
    StreakModule,
    ChallengesModule,
  ],
  controllers: [
    RecordsController,
    AppealsController,
    AiIngestController,
    AdminVerificationsController,
    AdminAppealsController,
  ],
  providers: [
    RecordsService,
    DecisionService,
    MissionOutcomeNotifier,
    AiIngestService,
    AdminReviewService,
    AppealsService,
    aiDispatcherProvider,
    AiDispatchService,
  ],
  exports: [
    RecordsService,
    DecisionService,
    MissionOutcomeNotifier,
    AiDispatchService,
  ],
})
export class VerificationModule {}
