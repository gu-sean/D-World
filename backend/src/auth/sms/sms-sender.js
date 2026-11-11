import { Logger } from '@nestjs/common';

/** DI 토큰: 문자 발송 구현, send(phoneE164, message)를 가진 객체 */
export const SMS_SENDER = Symbol('SMS_SENDER');

/** 개발 전용: 발송 대신 로그에 출력, 운영에서는 환경 변수 검증이 막음 */
class ConsoleSmsSender {
  logger = new Logger('ConsoleSmsSender');

  async send(phoneE164, message) {
    this.logger.warn(`[SMS 대체 출력] ${phoneE164}: ${message}`);
  }
}

export function createSmsSender(config) {
  const provider = config.get('SMS_DRIVER');
  if (provider === 'console') return new ConsoleSmsSender();
  throw new Error(`지원하지 않는 SMS_DRIVER: ${provider}`);
}
