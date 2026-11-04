import {
  Dependencies,
  HttpStatus,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { ConsentService } from './consent.service.js';
import { RestrictionService } from './restriction.service.js';

/**
 * 새 활동(작성·제출·개설·참여)용 검사: 이용 제한 중이거나 재동의가 필요하면 거절
 * 조회 API에는 붙이지 않음, 사용자 인증 guard 뒤에 실행됨
 */
@Injectable()
@Dependencies(RestrictionService, ConsentService)
export class ActiveAccountGuard {
  constructor(restrictions, consents) {
    this.restrictions = restrictions;
    this.consents = consents;
  }

  async canActivate(context) {
    const { userId } = context.switchToHttp().getRequest().auth;
    await this.assertActive(userId);
    return true;
  }

  /** 요청 내용에 따라 검사 여부가 달라지는 API(예: 메모만 바꾸면 허용)는 서비스가 직접 호출 */
  async assertActive(userId) {
    const restriction = await this.restrictions.activeRestriction(userId);
    if (restriction) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'account_restricted',
        '이용이 제한된 계정',
        { details: { until: restriction.ends_at } },
      );
    }
    const pending = await this.consents.pendingReconsent(userId);
    if (pending.length > 0) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'reconsent_required',
        '변경된 약관에 동의해야 함',
        { details: { documents: pending } },
      );
    }
  }
}

export const RequireActive = () => UseGuards(ActiveAccountGuard);
