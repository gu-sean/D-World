import { idOf, jsonObject, validateBody } from '../../common/validation.js';
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
  async start(req, id, res) {
    const { created, record } = await this.records.startRecord(
      req.auth.userId,
      idOf(id),
    );
    res.status(created ? 201 : 200);
    return record;
  }

  @Get('missions/:id/records')
  @Bind(Req(), Param('id'))
  list(req, id) {
    return this.records.listRecords(req.auth.userId, idOf(id));
  }

  @Get('records/:id')
  @Bind(Req(), Param('id'))
  get(req, id) {
    return this.records.getRecord(req.auth.userId, idOf(id));
  }

  /** 센서 요약(metrics)은 원시 파일이 없는 센서 미션에서 필요 */
  @Post('records/:id/submit')
  @Idempotent()
  @HttpCode(200)
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  submit(req, id, body) {
    return this.records.submitRecord(
      req.auth.userId,
      idOf(id),
      validateBody(body, { metrics: jsonObject({ optional: true }) }),
    );
  }

  @Post('records/:id/abort')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  abort(req, id) {
    return this.records.abortRecord(req.auth.userId, idOf(id));
  }
}
