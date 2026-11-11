import { isSmsSendRequest } from '../../../src/common/http/sms-throttle.js';

describe('isSmsSendRequest', () => {
  it('문자 발송 경로의 POST만 해당', () => {
    const post = (path) => ({ method: 'POST', path });
    expect(isSmsSendRequest(post('/auth/phone-verifications'))).toBe(true);
    expect(isSmsSendRequest(post('/auth/phone/codes'))).toBe(true);
    expect(isSmsSendRequest(post('/me/phone/codes'))).toBe(true);
    expect(
      isSmsSendRequest(post('/auth/phone-verifications/abc/confirm')),
    ).toBe(false);
    expect(
      isSmsSendRequest({ method: 'GET', path: '/auth/phone-verifications' }),
    ).toBe(false);
    expect(isSmsSendRequest({ method: 'POST' })).toBe(false);
  });
});
