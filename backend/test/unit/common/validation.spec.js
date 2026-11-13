import { BadRequestException } from '@nestjs/common';
import {
  array,
  boolean,
  nickname,
  normalizeKoreanPhone,
  object,
  phone,
  shortId,
  validateBody,
} from '../../../src/common/validation.js';

describe('normalizeKoreanPhone', () => {
  it.each([
    ['010-1234-5678', '+821012345678'],
    ['01012345678', '+821012345678'],
    ['+82 10 1234 5678', '+821012345678'],
    ['0161234567', '+82161234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeKoreanPhone(input)).toBe(expected);
  });

  it.each(['abc', '021234567', '010-123', '+15551234567', '', '01a12345678'])(
    '거절: %s',
    (input) => {
      expect(normalizeKoreanPhone(input)).toBeNull();
    },
  );
});

describe('validateBody', () => {
  it('스펙에 없는 필드는 버리고 값 정규화', () => {
    const out = validateBody(
      { phone: '010-1111-2222', nickname: '홍길동', extra: 'x' },
      { phone: phone(), nickname: nickname() },
    );
    expect(out).toEqual({ phone: '+821011112222', nickname: '홍길동' });
  });

  it('오류는 필드별 메시지 배열로 400', () => {
    try {
      validateBody({ nickname: 'a' }, { nickname: nickname(), phone: phone() });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().message).toHaveLength(2);
    }
  });

  it('선택 필드는 없어도 통과, 본문이 객체가 아니면 거절', () => {
    expect(
      validateBody({}, { nickname: nickname({ optional: true }) }),
    ).toEqual({});
    expect(() => validateBody([], { a: boolean() })).toThrow(
      BadRequestException,
    );
  });

  it('닉네임은 한글·영문·숫자 2~12자', () => {
    const rule = nickname();
    expect(rule('가나다abc12').value).toBe('가나다abc12');
    expect(rule('a b').error).toBeDefined();
    expect(rule('열세글자열세글자열세글자열').error).toBeDefined();
  });

  it('배열·중첩 객체·ID 검증', () => {
    const rule = array(object({ id: shortId(), granted: boolean() }), {
      max: 2,
    });
    const id = 'QgGYprtI';
    expect(rule([{ id, granted: true }]).value).toEqual([
      { id, granted: true },
    ]);
    expect(rule([{ id: 'x', granted: true }]).error).toMatch(/id/);
    expect(rule([{}, {}, {}]).error).toBeDefined();
  });

  it('ID는 8자 영숫자이고 대소문자를 그대로 유지하며, 선택 값은 비어 있어도 됨', () => {
    expect(shortId()('QgGYprtI').value).toBe('QgGYprtI');
    expect(shortId()('qggyprti').value).toBe('qggyprti');
    expect(shortId()('QgGYprt').error).toBeDefined();
    expect(shortId()('QgGYprtI9').error).toBeDefined();
    expect(shortId()('QgGY-prt').error).toBeDefined();
    expect(shortId()('not-a-uuid').error).toBeDefined();
    expect(shortId()(undefined).error).toBeDefined();
    expect(shortId({ optional: true })(undefined)).toEqual({
      value: undefined,
    });
  });
});
