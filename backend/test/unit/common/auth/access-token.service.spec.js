import { JwtService } from '@nestjs/jwt';
import { AccessTokenService } from '../../../../src/common/auth/access-token.service.js';

const config = {
  get: (key) =>
    ({
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      ADMIN_JWT_SECRET: 'b'.repeat(40),
      ACCESS_TOKEN_TTL_SEC: 1800,
      ADMIN_ACCESS_TOKEN_TTL_SEC: 900,
    })[key],
};

describe('AccessTokenService', () => {
  const service = new AccessTokenService(new JwtService({}), config);

  it('발급한 토큰을 같은 종류로 검증', async () => {
    const token = await service.issue('user', 'user-1', 'sess-1');
    expect(await service.verify('user', token)).toEqual({
      ownerId: 'user-1',
      sessionId: 'sess-1',
    });
  });

  it('사용자 토큰은 관리자 검증에, 관리자 토큰은 사용자 검증에 쓸 수 없음', async () => {
    const user = await service.issue('user', 'u', 's');
    const admin = await service.issue('admin', 'a', 's');
    await expect(service.verify('admin', user)).rejects.toMatchObject({
      status: 401,
    });
    await expect(service.verify('user', admin)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('변조·만료 토큰 거절', async () => {
    const token = await service.issue('user', 'u', 's');
    await expect(service.verify('user', `${token}x`)).rejects.toMatchObject({
      status: 401,
    });
    const expired = await new JwtService({}).signAsync(
      { sub: 'u', sid: 's', typ: 'user' },
      { secret: 'a'.repeat(40), expiresIn: -10 },
    );
    await expect(service.verify('user', expired)).rejects.toMatchObject({
      status: 401,
    });
  });
});
