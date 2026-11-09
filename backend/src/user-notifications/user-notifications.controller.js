import {
  Bind,
  Body,
  Controller,
  Delete,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { parseLimit } from '../common/pagination/limit.js';
import { pickEnum } from '../common/pagination/admin-page.js';
import { idOf, oneOf, string, validateBody } from '../common/validation.js';
import { UserNotificationsService } from './user-notifications.service.js';

const cursorOf = (query) =>
  typeof query.cursor === 'string' && query.cursor !== ''
    ? query.cursor
    : undefined;

/** 앱 알림함·푸시 기기·공지 API */
@Controller()
@Dependencies(UserNotificationsService)
export class UserNotificationsController {
  constructor(notifications) {
    this.notifications = notifications;
  }

  /** 알림 목록 (?limit=20&cursor=&unreadOnly=true) */
  @Get('me/notifications')
  @Bind(Req(), Query(), Res({ passthrough: true }))
  async list(request, query, response) {
    const page = await this.notifications.listNotifications(
      request.auth.userId,
      {
        limit: parseLimit(query, 20, 50),
        cursor: cursorOf(query),
        unreadOnly: pickEnum(query, 'unreadOnly', ['true', 'false']) === 'true',
      },
    );
    // 모바일 A110: 안 읽은 개수는 헤더로 내려준다
    const unread = await this.notifications.unreadCount(request.auth.userId);
    response.setHeader('X-Unread-Count', String(unread?.count ?? unread ?? 0));
    return page;
  }

  @Get('me/notifications/unread-count')
  @Bind(Req())
  unreadCount(request) {
    return this.notifications.unreadCount(request.auth.userId);
  }

  @Post('me/notifications/read-all')
  @HttpCode(200)
  @Bind(Req())
  readAll(request) {
    return this.notifications.markAllRead(request.auth.userId);
  }

  @Post('me/notifications/:notificationId/read')
  @HttpCode(200)
  @Bind(Req(), Param('notificationId'))
  read(request, notificationId) {
    return this.notifications.markRead(
      request.auth.userId,
      idOf(notificationId),
    );
  }

  /** 푸시 기기 등록·갱신 */
  @Put('me/push-devices')
  @Bind(Req(), Body())
  registerDevice(request, body) {
    return this.notifications.registerDevice(
      request.auth.userId,
      validateBody(body, {
        platform: oneOf(['android', 'ios']),
        token: string({ min: 1, max: 4096, pattern: /\S/ }),
      }),
    );
  }

  /** A16: 토큰으로 해제, 본문 없이 204 */
  @Post('me/push-devices/unregister')
  @HttpCode(204)
  @Bind(Req(), Body())
  async unregisterDevice(request, body) {
    const { token } = validateBody(body, {
      token: string({ min: 1, max: 4096, pattern: /\S/ }),
    });
    await this.notifications.unregisterByToken(request.auth.userId, token);
  }

  @Delete('me/push-devices/:deviceId')
  @HttpCode(204)
  @Bind(Req(), Param('deviceId'))
  async deactivateDevice(request, deviceId) {
    await this.notifications.deactivateDevice(
      request.auth.userId,
      idOf(deviceId),
    );
  }

  @Get('notices')
  @Bind(Req(), Query())
  listNotices(request, query) {
    return this.notifications.listNotices(request.auth.userId, {
      limit: parseLimit(query, 20, 50),
      cursor: cursorOf(query),
    });
  }

  @Get('notices/:noticeId')
  @Bind(Req(), Param('noticeId'))
  getNotice(request, noticeId) {
    return this.notifications.getNotice(request.auth.userId, idOf(noticeId));
  }
}
