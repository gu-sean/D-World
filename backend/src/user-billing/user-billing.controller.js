import { Controller, Get, HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';

/**
 * 구독 A130 (껍데기): 결제 연동 전이라 로그인한 사용자에게 항상 501 COMMON_NOT_IMPLEMENTED
 * 앱 화면은 "준비 중"을 보여 준다. 관리자 쪽 M110은 admin-dashboard가 맡는다.
 */
@Controller('me/subscription')
export class UserBillingController {
  @Get()
  get() {
    throw new AppException(
      HttpStatus.NOT_IMPLEMENTED,
      'COMMON_NOT_IMPLEMENTED',
      '준비 중인 기능이에요.',
    );
  }
}
