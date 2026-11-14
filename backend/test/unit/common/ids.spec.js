import { ID_PATTERN, isId, newId } from '../../../src/common/ids.js';
import {
  isIdCollision,
  isRetryableError,
} from '../../../src/database/database.service.js';

describe('common/ids.js', () => {
  it('8자 영숫자 ID를 만든다', () => {
    for (let i = 0; i < 200; i++) expect(newId()).toMatch(ID_PATTERN);
  });

  it('연속으로 만든 ID가 겹치지 않는다', () => {
    const ids = new Set(Array.from({ length: 20_000 }, () => newId()));
    expect(ids.size).toBe(20_000);
  });

  it('대소문자와 숫자가 모두 나오고 모든 문자가 허용 범위 안에 있다', () => {
    const text = Array.from({ length: 2_000 }, () => newId()).join('');
    expect(text).toMatch(/[0-9]/);
    expect(text).toMatch(/[A-Z]/);
    expect(text).toMatch(/[a-z]/);
    expect(text).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('isId: 형식이 맞는 문자열만 통과', () => {
    expect(isId('QgGYprtI')).toBe(true);
    expect(isId('00000004')).toBe(true);
    expect(isId('tester01')).toBe(true);
    expect(isId('QgGYprt')).toBe(false);
    expect(isId('QgGYprtI9')).toBe(false);
    expect(isId('QgGY-prt')).toBe(false);
    expect(isId(12345678)).toBe(false);
    expect(isId(null)).toBe(false);
  });
});

describe('ID 충돌 재시도', () => {
  it('PK 중복(23505, *_pkey)만 ID 충돌로 보고 재시도한다', () => {
    const pk = { code: '23505', constraint: 'missions_pkey' };
    expect(isIdCollision(pk)).toBe(true);
    expect(isRetryableError(pk)).toBe(true);
  });

  it('다른 유니크 제약 위반은 재시도하지 않는다', () => {
    const other = { code: '23505', constraint: 'users_phone_key' };
    expect(isIdCollision(other)).toBe(false);
    expect(isRetryableError(other)).toBe(false);
    expect(isRetryableError({ code: '40001' })).toBe(true);
    expect(isRetryableError(new Error('x'))).toBe(false);
  });
});
