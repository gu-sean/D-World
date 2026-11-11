import {
  idOf,
  jsonObject,
  oneOf,
  validateBody,
} from '../../common/validation.js';
import { RecordsService } from './records.service.js';
import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../../accounts/active-account.guard.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../../common/idempotency/user-idempotency.interceptor.js';

@Controller()
@Dependencies(RecordsService)
@UseInterceptors(UserIdempotencyInterceptor)
export class RecordsController {
  constructor(records) {
    this.records = records;
  }

  /** 새 회차는 201, 이미 열려 있던 회차를 돌려줄 때는 200 */
  @Post('missions/:id/records')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('id'), Res({ passthrough: true }))
  async start(request, id, response) {
    const { created, record } = await this.records.startRecord(
      request.auth.userId,
      idOf(id),
    );
    response.status(created ? 201 : 200);
    return record;
  }

  @Get('missions/:id/records')
  @Bind(Req(), Param('id'))
  list(request, id) {
    return this.records.listRecords(request.auth.userId, idOf(id));
  }

  @Get('records/:id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.records.getRecord(request.auth.userId, idOf(id));
  }

  /** 센서 요약(metrics)은 원시 파일이 없는 센서 미션에서 필요 */
  @Post('records/:id/submit')
  @Idempotent()
  @HttpCode(200)
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  submit(request, id, body) {
    return this.records.submitRecord(
      request.auth.userId,
      idOf(id),
      validateBody(body, { metrics: jsonObject({ optional: true }) }),
    );
  }

  /** A41 */
  @Get('mission-records/:id')
  @Bind(Req(), Param('id'))
  getMobile(request, id) {
    return this.records.getRecord(request.auth.userId, idOf(id));
  }

  /** A42: 본문 없이 204 */
  @Post('mission-records/:id/abort')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async abortMobile(request, id) {
    await this.records.abortRecord(request.auth.userId, idOf(id));
  }

  /** A45: 202 + MissionRecord, 판정은 나중에 붙음 */
  @Post('mission-records/:id/submit')
  @Idempotent()
  @HttpCode(202)
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  submitMobile(request, id, body) {
    const data = validateBody(body, {
      evidenceKind: oneOf(['camera_media', 'sensor_raw', 'sensor_summary'], {
        optional: true,
      }),
      clientMetrics: jsonObject({ optional: true }),
    });
    return this.records.submitRecord(request.auth.userId, idOf(id), {
      metrics: data.clientMetrics,
    });
  }

  @Post('records/:id/abort')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  abort(request, id) {
    return this.records.abortRecord(request.auth.userId, idOf(id));
  }
}
