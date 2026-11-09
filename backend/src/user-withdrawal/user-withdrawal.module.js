import { Module } from '@nestjs/common';
import { UserWithdrawalController } from './user-withdrawal.controller.js';
import { UserWithdrawalService } from './user-withdrawal.service.js';

/** 앱 회원 탈퇴 요청·철회·상태 조회 */
@Module({
  controllers: [UserWithdrawalController],
  providers: [UserWithdrawalService],
})
export class UserWithdrawalModule {}
