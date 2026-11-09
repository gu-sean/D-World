import { Module } from '@nestjs/common';
import { UserNotificationsController } from './user-notifications.controller.js';
import { UserNotificationsService } from './user-notifications.service.js';

/** 앱 알림함·푸시 기기 등록·공지 조회 */
@Module({
  controllers: [UserNotificationsController],
  providers: [UserNotificationsService],
})
export class UserNotificationsModule {}
