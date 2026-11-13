import { jest } from '@jest/globals';
import { PROBE_TOKEN, checkFcm } from '../../../src/notices/push/fcm-check.js';

const failing = (error) => ({ send: jest.fn().mockRejectedValue(error) });
const errorWith = (code, message = '') =>
  Object.assign(new Error(message), { code });

describe('checkFcm', () => {
  it('dryRun(true)로 보내고, 토큰이 없으면 가짜 토큰을 쓴다', async () => {
    const messaging = failing(errorWith('messaging/invalid-argument'));
    await checkFcm({ messaging });
    const [message, dryRun] = messaging.send.mock.calls[0];
    expect(dryRun).toBe(true);
    expect(message.token).toBe(PROBE_TOKEN);
  });

  it('실제 토큰까지 통과하면 verified', async () => {
    const messaging = {
      send: jest.fn().mockResolvedValue('projects/x/messages/1'),
    };
    const result = await checkFcm({ messaging, token: 'real-token' });
    expect(result).toMatchObject({ ok: true, kind: 'verified' });
    expect(messaging.send.mock.calls[0][0].token).toBe('real-token');
  });

  it('가짜 토큰이라 토큰 오류가 나면 "키는 정상"', async () => {
    for (const code of [
      'messaging/invalid-argument',
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ]) {
      const result = await checkFcm({ messaging: failing(errorWith(code)) });
      expect(result).toMatchObject({ ok: true, kind: 'credentials_ok', code });
    }
  });

  it('실제 토큰을 줬는데 토큰 오류면 키는 정상이지만 토큰이 틀림(실패)', async () => {
    const result = await checkFcm({
      messaging: failing(
        errorWith('messaging/registration-token-not-registered'),
      ),
      token: 'old-token',
    });
    expect(result).toMatchObject({ ok: false, kind: 'token_invalid' });
    expect(result.message).toContain('서비스 계정(키)은 정상');
  });

  it('구글이 서비스 계정을 거절하면 credentials_rejected', async () => {
    for (const code of [
      'app/invalid-credential',
      'messaging/authentication-error',
      'messaging/third-party-auth-error',
      'messaging/mismatched-credential',
    ]) {
      const result = await checkFcm({
        messaging: failing(errorWith(code, 'invalid_grant')),
      });
      expect(result).toMatchObject({
        ok: false,
        kind: 'credentials_rejected',
        code,
      });
    }
  });

  it('네트워크 오류는 network로 구분', async () => {
    const result = await checkFcm({
      messaging: failing(
        errorWith(
          'app/network-error',
          'getaddrinfo ENOTFOUND fcm.googleapis.com',
        ),
      ),
    });
    expect(result).toMatchObject({ ok: false, kind: 'network' });
  });

  it('알 수 없는 오류는 unknown, 설명은 짧게 잘라 돌려줌(인증 정보가 길게 새지 않게)', async () => {
    const long = `${'A'.repeat(500)}`;
    const result = await checkFcm({
      messaging: failing(errorWith('messaging/internal-error', long)),
    });
    expect(result).toMatchObject({ ok: false, kind: 'unknown' });
    expect(result.message.length).toBeLessThan(260);
  });
});
