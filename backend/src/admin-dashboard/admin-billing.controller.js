import { Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { AppException } from '../common/errors/app-exception.js';

const notImplemented = () =>
  new AppException(
    HttpStatus.NOT_IMPLEMENTED,
    'COMMON_NOT_IMPLEMENTED',
    '준비 중인 기능이에요.',
  );

/**
 * 결제·구독 M110 (껍데기): 인증만 거치고 모두 501 COMMON_NOT_IMPLEMENTED
 * 결제 연동 전이라 멱등 키·reason 검사나 감사 로그는 아직 두지 않음
 */
@Controller('admin/v1')
@AdminOnly()
export class AdminBillingController {
  @Get('subscriptions')
  listSubscriptions() {
    throw notImplemented();
  }

  @Get('payments')
  listPayments() {
    throw notImplemented();
  }

  @Post('payments/:paymentId/refunds')
  refund() {
    throw notImplemented();
  }

  @Post('users/:userId/entitlements/restore')
  restoreEntitlements() {
    throw notImplemented();
  }
}
