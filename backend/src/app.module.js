import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountsModule } from './accounts/accounts.module.js';
import { AiProposalsModule } from './ai-proposals/ai-proposals.module.js';
import { AchievementsModule } from './achievements/achievements.module.js';
import { AdminAuthModule } from './admin-auth/admin-auth.module.js';
import { AdminPoliciesModule } from './admin-policies/admin-policies.module.js';
import { ChallengesModule } from './challenges/challenges.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthCoreModule } from './common/auth/auth-core.module.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { ExperiencePetsModule } from './experience-pets/experience-pets.module.js';
import { GoalsModule } from './goals/goals.module.js';
import { HealthModule } from './health/health.module.js';
import { MissionDefinitionsModule } from './mission-definitions/mission-definitions.module.js';
import { StreakModule } from './streak/streak.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MediaModule } from './media/media.module.js';
import { MissionsModule } from './missions/missions.module.js';
import { VerificationModule } from './verification/verification.module.js';
import { PointsModule } from './points/points.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // IP당 기본 제한, 인증 경로는 컨트롤러에서 더 엄격하게 지정
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthCoreModule,
    AccountsModule,
    AuthModule,
    AdminAuthModule,
    PointsModule,
    ExperiencePetsModule,
    AchievementsModule,
    GoalsModule,
    MissionsModule,
    MissionDefinitionsModule,
    AiProposalsModule,
    MediaModule,
    VerificationModule,
    StreakModule,
    AdminPoliciesModule,
    ChallengesModule,
    JobsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
