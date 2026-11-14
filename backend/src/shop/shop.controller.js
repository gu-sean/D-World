import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { parseLimit } from '../common/pagination/limit.js';
import {
  idOf,
  integer,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import { ShopService } from './shop.service.js';

/** 앱 포인트 상점 API */
@Controller('shop')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(ShopService)
export class ShopController {
  constructor(shop) {
    this.shop = shop;
  }

  @Get('items')
  @Bind(Req())
  items(request) {
    return this.shop.listItems(request.auth.userId);
  }

  @Post('orders')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Body())
  purchase(request, body) {
    return this.shop.purchase(request.auth.userId, {
      ...validateBody(body, {
        itemId: shortId(),
        priceVersionId: shortId({ optional: true }),
        quantity: integer({ min: 1, max: 99 }),
      }),
      idempotencyKey: readIdempotencyKey(request),
    });
  }

  @Get('orders')
  @Bind(Req(), Query())
  orders(request, query) {
    return this.shop.listOrders(request.auth.userId, {
      limit: parseLimit(query, 20, 50),
      cursor:
        typeof query.cursor === 'string' && query.cursor !== ''
          ? query.cursor
          : undefined,
    });
  }

  @Get('orders/:orderId')
  @Bind(Req(), Param('orderId'))
  order(request, orderId) {
    return this.shop.getOrder(request.auth.userId, idOf(orderId));
  }

  /** 사용하지 않은 주문만 취소·환불 (이용 제한 중이어도 환불은 가능해야 해 @RequireActive 없음) */
  @Post('orders/:orderId/cancel')
  @HttpCode(200)
  @Bind(Req(), Param('orderId'), Body())
  cancel(request, orderId, body) {
    const { reason } = validateBody(body, {
      reason: string({ min: 1, max: 200, pattern: /\S/ }),
    });
    return this.shop.cancelOrder(request.auth.userId, idOf(orderId), reason);
  }

  @Get('inventory')
  @Bind(Req())
  inventory(request) {
    return this.shop.listInventory(request.auth.userId);
  }

  @Post('inventory/:itemId/use')
  @HttpCode(200)
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('itemId'), Body())
  use(request, itemId, body) {
    const { quantity } = validateBody(body, {
      quantity: integer({ min: 1, max: 99, optional: true }),
    });
    return this.shop.useItem(request.auth.userId, {
      itemId: idOf(itemId),
      quantity: quantity ?? 1,
      idempotencyKey: readIdempotencyKey(request),
    });
  }
}
