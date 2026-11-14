import { Injectable } from '@nestjs/common';

/** 관리자 작업에 사유를 적지 않았을 때 감사 로그·DB에 남는 문구 */
export const DEFAULT_ADMIN_REASON = '관리자 처리';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 전역 인터셉터: 관리자 변경 요청(/admin/v1, POST·PUT·PATCH·DELETE)에서 `reason`이 비었으면
 * 기본 문구를 채운다. 관리자 웹은 사유를 선택 입력으로 받는다.
 *
 * 컨트롤러의 검증 규칙(REASON_RULE_OPTIONS 등)과 DB의 "사유는 비어 있으면 안 됨" 제약은 그대로 두고,
 * 비어 있는 값만 이 자리에서 바꾼다. 로그인·로그아웃·토큰 갱신에는 사유가 없어서 건드리지 않는다.
 */
@Injectable()
export class DefaultReasonInterceptor {
  intercept(context, next) {
    const request = context.switchToHttp().getRequest();
    const path = request?.path ?? request?.url ?? '';
    if (
      request &&
      MUTATING.has(request.method) &&
      path.startsWith('/admin/v1/') &&
      !path.startsWith('/admin/v1/auth/')
    ) {
      const body = request.body;
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const reason =
          typeof body.reason === 'string' ? body.reason.trim() : '';
        if (!reason) body.reason = DEFAULT_ADMIN_REASON;
      } else if (
        request.method !== 'DELETE' &&
        (body === undefined || body === null)
      ) {
        request.body = { reason: DEFAULT_ADMIN_REASON };
      }
    }
    return next.handle();
  }
}
