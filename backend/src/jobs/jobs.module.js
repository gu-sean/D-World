import { Module } from '@nestjs/common';
import { AiProposalsModule } from '../ai-proposals/ai-proposals.module.js';
import { ChallengesModule } from '../challenges/challenges.module.js';
import { MediaModule } from '../media/media.module.js';
import { MissionsModule } from '../missions/missions.module.js';
import { StreakModule } from '../streak/streak.module.js';
import { VerificationModule } from '../verification/verification.module.js';
import { JobsService } from './jobs.service.js';

/** 주기 작업(AI 판정 요청, 업로드·탈퇴 파일 정리, 미션 마감, AI 제안 만료)의 스케줄러 */
@Module({
  imports: [
    MediaModule,
    MissionsModule,
    AiProposalsModule,
    VerificationModule,
    StreakModule,
    ChallengesModule,
  ],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
