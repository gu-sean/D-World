import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { AiAnalysisModule } from '../ai-analysis/ai-analysis.module.js';
import { AiProposalsModule } from '../ai-proposals/ai-proposals.module.js';
import { ChallengesModule } from '../challenges/challenges.module.js';
import { MediaModule } from '../media/media.module.js';
import { NoticesModule } from '../notices/notices.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { MissionsModule } from '../missions/missions.module.js';
import { StreakModule } from '../streak/streak.module.js';
import { VerificationModule } from '../verification/verification.module.js';
import { DevJobsController } from './dev-jobs.controller.js';
import { JobLock } from './job-lock.service.js';
import { JobsService } from './jobs.service.js';

/** 정기 작업(AI 판정 요청, 공지 게시·알림 생성·푸시 발송, 업적 소급 평가, 탈퇴 완료, 파일 정리, 미션 마감, 스트릭·챌린지 확정·지급, AI 제안 만료, 멱등 키 정리, 시간별 날씨 수집)의 스케줄러 */
@Module({
  imports: [
    MediaModule,
    MissionsModule,
    AiProposalsModule,
    AiAnalysisModule,
    VerificationModule,
    StreakModule,
    ChallengesModule,
    NoticesModule,
    AchievementsModule,
    RecommendationsModule,
  ],
  // 수동 실행 경로는 운영에서 등록하지 않음
  controllers: process.env.NODE_ENV === 'production' ? [] : [DevJobsController],
  providers: [JobsService, JobLock],
  exports: [JobsService],
})
export class JobsModule {}
