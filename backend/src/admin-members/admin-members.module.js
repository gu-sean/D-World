import { Module } from '@nestjs/common';
import { AdminMembersController } from './admin-members.controller.js';
import { AdminMembersService } from './admin-members.service.js';
import { AdminSupportController } from './admin-support.controller.js';

/** 관리자 회원(M10~M16)·문의 신고(M20~M24) API */
@Module({
  controllers: [AdminMembersController, AdminSupportController],
  providers: [AdminMembersService],
})
export class AdminMembersModule {}
