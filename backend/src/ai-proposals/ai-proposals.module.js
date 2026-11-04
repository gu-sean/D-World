import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module.js';
import { MissionsModule } from '../missions/missions.module.js';
import { ProposalsController } from './proposals.controller.js';
import { ProposalsService } from './proposals.service.js';

/** 제안 생성은 AiResultsModule 몫, 여기서는 사용자의 수락·거절과 만료 처리 */
@Module({
  imports: [GoalsModule, MissionsModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class AiProposalsModule {}
