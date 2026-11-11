import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module.js';
import { MissionsModule } from '../missions/missions.module.js';
import { PlanAdjustmentsController } from './plan-adjustments.controller.js';
import { PlanAdjustmentsService } from './plan-adjustments.service.js';
import { MobileProposalsController } from './mobile-proposals.controller.js';
import { MobileProposalsService } from './mobile-proposals.service.js';
import { ProposalsController } from './proposals.controller.js';
import { ProposalsService } from './proposals.service.js';

/**
 * AI 계획 제안
 * - 생성(A25): 규칙 기반 생성기(rule-planner.js), AI 서버 규격(I03) 확정 뒤 교체
 * - 수락·거절·만료: ProposalsService
 * - 재조정 제안(A50~A53): 제안 생성은 AI 서버 몫, 여기서는 조회·수락·거절만
 */
@Module({
  imports: [GoalsModule, MissionsModule],
  controllers: [
    ProposalsController,
    MobileProposalsController,
    PlanAdjustmentsController,
  ],
  providers: [ProposalsService, MobileProposalsService, PlanAdjustmentsService],
  exports: [ProposalsService],
})
export class AiProposalsModule {}
