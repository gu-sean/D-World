import {
  mobileCompatMiddleware,
  rewriteMobilePath,
} from '../../../../src/common/http/mobile-compat.middleware.js';

describe('rewriteMobilePath', () => {
  it('경로와 메서드를 백엔드 것으로 바꿈', () => {
    expect(rewriteMobilePath('GET', '/goal-categories')).toEqual({
      method: 'GET',
      path: '/categories',
    });
    expect(rewriteMobilePath('PUT', '/me/representative-badge')).toEqual({
      method: 'PATCH',
      path: '/me/profile/representative-achievement',
    });
  });

  it('경로 매개변수를 옮김', () => {
    expect(rewriteMobilePath('GET', '/support-tickets/abc-123')).toEqual({
      method: 'GET',
      path: '/me/support-tickets/abc-123',
    });
  });

  it('메서드가 다르거나 대상이 아니면 그대로 둠', () => {
    expect(rewriteMobilePath('POST', '/goal-categories')).toBeNull();
    expect(rewriteMobilePath('GET', '/support-tickets/a/b')).toBeNull();
    expect(rewriteMobilePath('GET', '/goals')).toBeNull();
  });
});

describe('mobileCompatMiddleware', () => {
  const run = (method, url) => {
    const request = { method, url };
    let called = false;
    mobileCompatMiddleware(request, {}, () => (called = true));
    return { request, called };
  };

  it('쿼리를 보존하며 /api/v1 요청만 바꿈', () => {
    const { request, called } = run(
      'GET',
      '/api/v1/auth/nickname-availability?nickname=abc',
    );
    expect(called).toBe(true);
    expect(request.url).toBe('/api/v1/nicknames/availability?nickname=abc');
    expect(run('GET', '/admin/v1/goal-categories').request.url).toBe(
      '/admin/v1/goal-categories',
    );
  });
});
