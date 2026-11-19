import { describe, expect, it } from 'vitest';
import { AdminError, toAdminError } from './errors.js';
import { shouldRetryQuery } from './retryPolicy.js';

const withResponse = (status, data) => ({ response: { status, data } });

describe('toAdminError', () => {
  it('uses the standard error body of the server', () => {
    const error = toAdminError(
      withResponse(400, {
        error: { code: 'COMMON_VALIDATION_FAILED', message: 'x', details: { fields: { a: 'b' } } },
      }),
    );
    expect(error).toBeInstanceOf(AdminError);
    expect(error).toMatchObject({ status: 400, code: 'COMMON_VALIDATION_FAILED' });
    expect(error.details.fields).toEqual({ a: 'b' });
  });

  it.each([
    [401, 'COMMON_UNAUTHORIZED'],
    [403, 'COMMON_FORBIDDEN'],
    [404, 'COMMON_NOT_FOUND'],
    [413, 'COMMON_PAYLOAD_TOO_LARGE'],
    [429, 'COMMON_RATE_LIMITED'],
    [502, 'COMMON_UNAVAILABLE'],
    [503, 'COMMON_UNAVAILABLE'],
    [504, 'COMMON_UNAVAILABLE'],
    [500, 'COMMON_INTERNAL'],
  ])('maps a %i answer without a standard body to %s', (status, code) => {
    const error = toAdminError(withResponse(status, '<html>bad gateway</html>'));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain('<html>');
  });

  it('tells a lost connection and a timeout apart, both with status 0', () => {
    expect(toAdminError({ code: 'ERR_NETWORK' })).toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
    expect(toAdminError({ code: 'ECONNABORTED' })).toMatchObject({
      code: 'NETWORK_TIMEOUT',
      status: 0,
    });
  });

  it('never leaks an unexpected value as a message', () => {
    expect(toAdminError(new Error('secret stack detail')).message).not.toContain('secret');
  });
});

describe('shouldRetryQuery', () => {
  it('repeats only when the server could not be reached, at most twice', () => {
    const offline = new AdminError({ code: 'NETWORK_ERROR', message: 'x', status: 0 });
    expect(shouldRetryQuery(0, offline)).toBe(true);
    expect(shouldRetryQuery(1, offline)).toBe(true);
    expect(shouldRetryQuery(2, offline)).toBe(false);
  });

  it('shows every answer of the server at once', () => {
    for (const status of [400, 401, 403, 404, 429, 500, 503]) {
      expect(shouldRetryQuery(0, { status })).toBe(false);
    }
  });
});
