import { Module } from '@nestjs/common';
import { UserSupportController } from './user-support.controller.js';
import { UserSupportService } from './user-support.service.js';

/** 앱 문의·신고 접수와 내 접수 내역 */
@Module({
  controllers: [UserSupportController],
  providers: [UserSupportService],
})
export class UserSupportModule {}
