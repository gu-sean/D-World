import { Module } from '@nestjs/common';
import { AiAnalysisController } from './ai-analysis.controller.js';
import { AiReportsService } from './ai-reports.service.js';
import { PlanAdjustmentRunsService } from './plan-adjustment-runs.service.js';

/** AI 분석 정기 작업(리포트 I05, 계획 재조정 I06)과 결과 콜백 수신 */
@Module({
  controllers: [AiAnalysisController],
  providers: [AiReportsService, PlanAdjustmentRunsService],
  exports: [AiReportsService, PlanAdjustmentRunsService],
})
export class AiAnalysisModule {}
