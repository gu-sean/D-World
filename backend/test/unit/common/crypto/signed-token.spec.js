import {
  readToken,
  signToken,
} from '../../../../src/common/crypto/signed-token.js';
import { maskPhone } from '../../../../src/auth/mobile-auth.service.js';

const SECRET = 's'.repeat(32);

describe('signed-token', () => {
  it('서명한 데이터를 같은 용도로 읽음', () => {
    const token = signToken(SECRET, 'k', { phone: '+821000000001' }, 60);
    expect(readToken(SECRET, 'k', token)).toEqual({ phone: '+821000000001' });
  });

  it('용도·비밀·내용이 다르면 거부', () => {
    const token = signToken(SECRET, 'k', { a: 1 }, 60);
    expect(readToken(SECRET, 'other', token)).toBeNull();
    expect(readToken('x'.repeat(32), 'k', token)).toBeNull();
    const [body, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ k: 'k', d: { a: 2 }, exp: 9_999_999_999 }),
    ).toString('base64url');
    expect(readToken(SECRET, 'k', `${forged}.${sig}`)).toBeNull();
    expect(readToken(SECRET, 'k', `${body}.zz`)).toBeNull();
    expect(readToken(SECRET, 'k', undefined)).toBeNull();
    expect(readToken(SECRET, 'k', 'abc')).toBeNull();
  });

  it('만료된 토큰은 거부', () => {
    const token = signToken(SECRET, 'k', { a: 1 }, -1);
    expect(readToken(SECRET, 'k', token)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('010-****-0001 모양', () => {
    expect(maskPhone('+821000000001')).toBe('010-****-0001');
    expect(maskPhone('+821012345678')).toBe('010-****-5678');
  });
});
