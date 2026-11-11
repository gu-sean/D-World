import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { isSmsSendRequest } from './common/http/sms-throttle.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { AiProposalsModule } from './ai-proposals/ai-proposals.module.js';
import { AchievementsModule } from './achievements/achievements.module.js';
import { AdminAuthModule } from './admin-auth/admin-auth.module.js';
import { AdminPoliciesModule } from './admin-policies/admin-policies.module.js';
import { ChallengesModule } from './challenges/challenges.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthCoreModule } from './common/auth/auth-core.module.js';
import { CatalogCodeInterceptor } from './common/catalog-code/catalog-code.interceptor.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { ExperiencePetsModule } from './experience-pets/experience-pets.module.js';
import { GoalsModule } from './goals/goals.module.js';
import { HealthModule } from './health/health.module.js';
import { MissionDefinitionsModule } from './mission-definitions/mission-definitions.module.js';
import { HomeModule } from './home/home.module.js';
import { MobileRewardsModule } from './mobile-rewards/mobile-rewards.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { UserBillingModule } from './user-billing/user-billing.module.js';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module.js';
import { AiModule } from './integrations/ai/ai.module.js';
import { StreakModule } from './streak/streak.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MediaModule } from './media/media.module.js';
import { MissionsModule } from './missions/missions.module.js';
import { VerificationModule } from './verification/verification.module.js';
import { PointsModule } from './points/points.module.js';
import { AdminMembersModule } from './admin-members/admin-members.module.js';
import { AdminAssetsModule } from './admin-assets/admin-assets.module.js';
import { AdminContentModule } from './admin-content/admin-content.module.js';
import { UserNotificationsModule } from './user-notifications/user-notifications.module.js';
import { UserWithdrawalModule } from './user-withdrawal/user-withdrawal.module.js';
import { ShopModule } from './shop/shop.module.js';
import { UserSupportModule } from './user-support/user-support.module.js';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // IP당 기본 제한, 인증 경로는 컨트롤러에서 더 엄격하게 지정
    // sms: 번호를 바꿔가며 문자 발송 비용을 일으키는 남용 방어, 인증번호 발송 경로에만 적용(IP당 시간당 30건)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      {
        name: 'sms',
        ttl: 3_600_000,
        limit: 30,
        skipIf: (context) =>
          !isSmsSendRequest(context.switchToHttp().getRequest()),
      },
    ]),
    DatabaseModule,
    AuthCoreModule,
    AccountsModule,
    AuthModule,
    AdminAuthModule,
    PointsModule,
    AdminMembersModule,
    AdminAssetsModule,
    AdminContentModule,
    AdminDashboardModule,
    UserNotificationsModule,
    UserSupportModule,
    ShopModule,
    UserWithdrawalModule,
    ExperiencePetsModule,
    AchievementsModule,
    GoalsModule,
    MissionsModule,
    MissionDefinitionsModule,
    AiProposalsModule,
    MediaModule,
    VerificationModule,
    StreakModule,
    AiModule,
    AiAnalysisModule,
    HomeModule,
    UserBillingModule,
    RecommendationsModule,
    ReportsModule,
    MobileRewardsModule,
    AdminPoliciesModule,
    ChallengesModule,
    JobsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: CatalogCodeInterceptor },
  ],
})
export class AppModule {}
