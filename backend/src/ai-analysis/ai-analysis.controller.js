import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { assertInternalToken } from '../common/auth/internal-token.js';
import { Public } from '../common/auth/public.decorator.js';
import {
  array,
  jsonObject,
  object,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { AiReportsService } from './ai-reports.service.js';
import { PlanAdjustmentRunsService } from './plan-adjustment-runs.service.js';

const common = () => ({
  ingestKey: string({ min: 8, max: 200, pattern: /^[\x21-\x7e]+$/ }),
  runId: uuid(),
  status: oneOf(['completed', 'failed']),
  engineVersion: string({ min: 1, max: 80, pattern: /\S/ }),
  failureReason: string({ min: 0, max: 500, optional: true }),
});

/** 리포트 콜백 본문 (AI 계약 ReportCallback), 완료면 제목·요약 필수 */
export function parseReportCallback(body) {
  const input = validateBody(body, {
    ...common(),
    title: string({ min: 1, max: 160, pattern: /\S/, optional: true }),
    summary: string({ min: 1, max: 4000, pattern: /\S/, optional: true }),
    feedback: string({ min: 0, max: 4000, optional: true }),
    nextGoals: array(jsonObject({ maxBytes: 2048 }), {
      max: 10,
      optional: true,
    }),
    content: object(
      { highlights: array(string({ min: 0, max: 300 }), { max: 20 }) },
      { optional: true },
    ),
  });
  if (input.status === 'completed' && (!input.title || !input.summary)) {
    throw new BadRequestException(['title, summary: 완료된 리포트에 필요함']);
  }
  return input;
}

/** 재조정 콜백 본문 (AI 계약 PlanAdjustmentCallback), 완료면 proposedPlan 필수 */
export function parseAdjustmentCallback(body) {
  const input = validateBody(body, {
    ...common(),
    reason: string({ min: 0, max: 1000, optional: true }),
    proposedPlan: array(jsonObject({ maxBytes: 65_536 }), {
      max: 30,
      optional: true,
    }),
  });
  if (input.status === 'completed' && !input.proposedPlan?.length) {
    throw new BadRequestException(['proposedPlan: 완료된 재조정에 필요함']);
  }
  return input;
}

/** AI 서버가 비동기 결과를 돌려주는 내부 경로 (인증은 공유 비밀 헤더) */
@Controller('internal/v1/ai-callbacks')
@Public()
@SkipThrottle()
@Dependencies(ConfigService, AiReportsService, PlanAdjustmentRunsService)
export class AiAnalysisController {
  constructor(config, reports, adjustments) {
    this.config = config;
    this.reports = reports;
    this.adjustments = adjustments;
  }

  /** I05 주간·월간 리포트 결과 */
  @Post('reports')
  @HttpCode(200)
  @Bind(Req(), Body())
  receiveReport(request, body) {
    assertInternalToken(this.config, request);
    return this.reports.ingest(parseReportCallback(body));
  }

  /** I06 계획 재조정 결과 */
  @Post('plan-adjustments')
  @HttpCode(200)
  @Bind(Req(), Body())
  receiveAdjustment(request, body) {
    assertInternalToken(this.config, request);
    return this.adjustments.ingest(parseAdjustmentCallback(body));
  }
}
