import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { pickEnum } from '../common/pagination/admin-page.js';
import { parseLimit } from '../common/pagination/limit.js';
import {
  idOf,
  object,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { UserSupportService } from './user-support.service.js';

/**
 * 앱 문의·신고 API
 * 이용 제한 중인 회원도 제한에 대해 문의할 수 있어야 하므로 @RequireActive()를 붙이지 않음
 */
@Controller('me/support-tickets')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(UserSupportService)
export class UserSupportController {
  constructor(support) {
    this.support = support;
  }

  @Post()
  @Idempotent()
  @Bind(Req(), Body())
  create(request, body) {
    return this.support.createTicket(
      request.auth.userId,
      validateBody(body, {
        ticketType: oneOf(['inquiry', 'report']),
        category: string({ min: 1, max: 30 }),
        subject: string({ min: 1, max: 120, pattern: /\S/ }),
        body: string({ min: 1, max: 2000, pattern: /\S/ }),
        target: object(
          {
            kind: oneOf(['user', 'mission_definition', 'challenge']),
            id: uuid(),
          },
          { optional: true },
        ),
      }),
    );
  }

  @Get()
  @Bind(Req(), Query())
  list(request, query) {
    return this.support.listTickets(request.auth.userId, {
      limit: parseLimit(query, 20, 50),
      cursor:
        typeof query.cursor === 'string' && query.cursor !== ''
          ? query.cursor
          : undefined,
      ticketType: pickEnum(query, 'ticketType', ['inquiry', 'report']),
      status: pickEnum(query, 'status', ['received', 'in_review', 'completed']),
    });
  }

  @Get(':ticketId')
  @Bind(Req(), Param('ticketId'))
  get(request, ticketId) {
    return this.support.getTicket(request.auth.userId, idOf(ticketId));
  }
}
