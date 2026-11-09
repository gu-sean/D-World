/**
 * 앱 안에서 돌아다니는 **유일한** 오류 모양 (parts/mobile-client §3.3).
 *
 * 서버 오류·네트워크 오류·기기 오류를 모두 이것으로 바꿔서 던진다.
 * 화면은 `error.code`로 분기하고 `error.message`를 그대로 보여 준다.
 */
import { getErrorMessage } from './errorMessages.js';

export class AppError extends Error {
  /**
   * @param {string} code 05 §7의 오류 코드 또는 §7.7 앱 전용 코드
   * @param {number} status HTTP 상태. 네트워크·기기 오류는 0
   * @param {string} [message] 서버가 준 문구. 없으면 `errorMessages.js`의 문구
   * @param {object} [details] 서버 `details` (`fields`, `retryAfterSeconds` 등). 없으면 `{}`
   */
  constructor(code, status, message, details = {}) {
    super(message ?? getErrorMessage(code));
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details ?? {};
  }

  /** 네트워크 때문에 실패했는가 (조회 재시도 대상, parts/mobile-client §5.2). */
  get isNetwork() {
    return this.code === 'NETWORK_ERROR' || this.code === 'NETWORK_TIMEOUT';
  }

  /**
   * 서버 오류 본문을 `AppError`로 바꾼다.
   * 본문이 `{error:{code,message,details}}` 모양이 아니면 `COMMON_INTERNAL`로 본다 (§3.1 5번).
   * @param {number} status
   * @param {any} body 파싱한 응답 본문 (없으면 `null`)
   * @returns {AppError}
   */
  static fromResponse(status, body) {
    const error = body && typeof body === 'object' ? body.error : null;
    if (!error || typeof error.code !== 'string') {
      return new AppError('COMMON_INTERNAL', status);
    }
    return new AppError(
      error.code,
      status,
      typeof error.message === 'string' && error.message.length > 0 ? error.message : undefined,
      error.details && typeof error.details === 'object' ? error.details : {},
    );
  }

  /** 던져진 값이 무엇이든 `AppError`로 만들어 준다. */
  static wrap(error, fallbackCode = 'COMMON_INTERNAL') {
    if (error instanceof AppError) return error;
    return new AppError(fallbackCode, 0, undefined, {});
  }
}

export default AppError;
