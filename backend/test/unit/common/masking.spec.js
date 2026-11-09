import { maskEmail, maskPhone } from '../../../src/common/masking.js';

describe('maskPhone', () => {
  it.each([
    ['01012345678', '010-****-5678'],
    ['+821012345678', '010-****-5678'],
    ['010-1234-5678', '010-****-5678'],
    ['0111234567', '011-****-4567'],
  ])('%s → %s', (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  it('해석할 수 없는 값은 전부 가리고, 값이 없으면 null', () => {
    expect(maskPhone('02-123-4567')).toBe('***');
    expect(maskPhone('abc')).toBe('***');
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
  });
});

describe('maskEmail', () => {
  it('앞 1글자만 남기고 도메인은 유지', () => {
    expect(maskEmail('abc@example.com')).toBe('a***@example.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });

  it('형식이 다르면 전부 가리고, 값이 없으면 null', () => {
    expect(maskEmail('no-at-sign')).toBe('***');
    expect(maskEmail('@example.com')).toBe('***');
    expect(maskEmail('abc@')).toBe('***');
    expect(maskEmail(null)).toBeNull();
  });
});
