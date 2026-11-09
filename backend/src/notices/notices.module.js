import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoticeDeliveryService } from './notice-delivery.service.js';
import { createPushSender, PUSH_SENDER } from './push/push-sender.js';
import { PushDeliveryService } from './push-delivery.service.js';

/** 공지 게시·알림 생성·푸시 발송, 관리자 공지 게시(M93)와 정기 작업이 함께 사용 */
@Module({
  providers: [
    NoticeDeliveryService,
    PushDeliveryService,
    {
      provide: PUSH_SENDER,
      useFactory: (config) => createPushSender(config),
      inject: [ConfigService],
    },
  ],
  exports: [NoticeDeliveryService, PushDeliveryService, PUSH_SENDER],
})
export class NoticesModule {}
