import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./session.js', () => ({
  getAccessToken: vi.fn(() => 'token-1'),
  refresh: vi.fn(),
  clearSession: vi.fn(),
}));

const { http, setOnAuthFailure } = await import('./httpClient.js');
const session = await import('./session.js');

const unauthorized = (code = 'COMMON_UNAUTHORIZED') => ({
  status: 401,
  data: { error: { code, message: 'x' } },
});

/** Replaces the network: `responses` are used in order, each is a status and a body. */
function fakeNetwork(responses) {
  const seen = [];
  http.defaults.adapter = async (config) => {
    seen.push(config);
    const next = responses.shift();
    const response = { status: next.status, data: next.data, headers: {}, config, statusText: '' };
    if (next.status >= 400) {
      const error = new Error('fail');
      error.isAxiosError = true;
      error.config = config;
      error.response = response;
      throw error;
    }
    return response;
  };
  return seen;
}

beforeEach(() => {
  vi.clearAllMocks();
  setOnAuthFailure();
});

describe('http 401 handling', () => {
  it('refreshes once and repeats the request for any 401', async () => {
    const seen = fakeNetwork([unauthorized(), { status: 200, data: { ok: true } }]);
    session.refresh.mockResolvedValue({});
    const response = await http.get('/users');
    expect(response.data).toEqual({ ok: true });
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
  });

  it('also refreshes when the token is expired', async () => {
    fakeNetwork([unauthorized('AUTH_TOKEN_EXPIRED'), { status: 200, data: 'fine' }]);
    session.refresh.mockResolvedValue({});
    await expect(http.get('/users')).resolves.toMatchObject({ data: 'fine' });
  });

  it('goes to the login page when the refresh fails', async () => {
    fakeNetwork([unauthorized()]);
    session.refresh.mockRejectedValue(new Error('no session'));
    const onFailure = vi.fn();
    setOnAuthFailure(onFailure);
    await expect(http.get('/users')).rejects.toBeDefined();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toMatch(/^\/login\?next=/);
  });

  it('goes to the login page when the repeated request is refused again', async () => {
    fakeNetwork([unauthorized(), unauthorized()]);
    session.refresh.mockResolvedValue({});
    const onFailure = vi.fn();
    setOnAuthFailure(onFailure);
    await expect(http.get('/users')).rejects.toMatchObject({ status: 401 });
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(session.clearSession).toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for the login request itself', async () => {
    fakeNetwork([unauthorized('AUTH_INVALID_CREDENTIALS')]);
    await expect(http.post('/auth/login', { loginId: 'a', password: 'b' })).rejects.toMatchObject({
      status: 401,
    });
    expect(session.refresh).not.toHaveBeenCalled();
  });

  it('does not repeat other errors', async () => {
    const seen = fakeNetwork([
      { status: 500, data: { error: { code: 'COMMON_INTERNAL', message: 'x' } } },
    ]);
    await expect(http.get('/users')).rejects.toMatchObject({ status: 500 });
    expect(seen).toHaveLength(1);
    expect(session.refresh).not.toHaveBeenCalled();
  });

  it('sends the same Idempotency-Key again after a refresh', async () => {
    const seen = fakeNetwork([unauthorized(), { status: 200, data: {} }]);
    session.refresh.mockResolvedValue({});
    await http.post('/notices', { a: 1 }, { idempotencyKey: 'key-123' });
    expect(seen.map((config) => config.headers.get('Idempotency-Key'))).toEqual([
      'key-123',
      'key-123',
    ]);
  });
});
