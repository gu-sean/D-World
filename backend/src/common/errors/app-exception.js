import { HttpException } from '@nestjs/common';

/**
 * 클라이언트 분기용 code를 가진 오류
 * extra의 retryAfter(초)·details는 응답 본문까지 전달됨
 */
export class AppException extends HttpException {
  constructor(status, code, message, extra = {}) {
    super({ code, message, ...extra }, status);
  }
}
