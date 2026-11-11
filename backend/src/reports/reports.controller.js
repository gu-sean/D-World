import {
  Bind,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { parseLimit } from '../common/pagination/limit.js';
import {
  dateString,
  idOf,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { ReportsService } from './reports.service.js';

/** 리포트·달력 API A60~A64 (읽기 중심, 이용 제한 중에도 가능) */
@Controller()
@Dependencies(ReportsService)
export class ReportsController {
  constructor(reports) {
    this.reports = reports;
  }

  /** A60 (categoryCode 필터는 전역 인터셉터가 categoryId로 바꿔 줌) */
  @Get('reports/summary')
  @Bind(Req(), Query())
  summary(request, query) {
    const filters = validateBody(query, {
      period: oneOf(['week', 'month', 'all'], { optional: true }),
      date: dateString({ optional: true }),
      categoryId: uuid({ optional: true }),
    });
    return this.reports.summary(request.auth.userId, filters);
  }

  /** A61 */
  @Get('ai-reports')
  @Bind(Req(), Query())
  list(request, query) {
    const filters = validateBody(query, {
      runType: oneOf(['weekly_report', 'monthly_report'], { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    return this.reports.listReports(request.auth.userId, {
      ...filters,
      limit: parseLimit(query, 20, 50),
    });
  }

  /** A62 */
  @Get('ai-reports/:runId')
  @Bind(Req(), Param('runId'))
  get(request, runId) {
    return this.reports.getReport(request.auth.userId, idOf(runId));
  }

  /** A63 */
  @Post('ai-reports/:runId/read')
  @HttpCode(204)
  @Bind(Req(), Param('runId'))
  async read(request, runId) {
    await this.reports.markRead(request.auth.userId, idOf(runId));
  }

  /** A64 */
  @Get('calendar')
  @Bind(Req(), Query())
  calendar(request, query) {
    const { month } = validateBody(query, {
      month: string({ min: 7, max: 7, pattern: /^\d{4}-\d{2}$/ }),
    });
    return this.reports.calendar(request.auth.userId, month);
  }
}
