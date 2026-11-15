import {
  validateFitnessProfile,
  validateNickname,
  validatePassword,
  validatePasswordConfirm,
  validatePhone,
} from '../rules';

describe('휴대폰 번호', () => {
  test('010으로 시작하는 11자리만 통과한다', () => {
    expect(validatePhone('01012345678').ok).toBe(true);
    expect(validatePhone(' 01012345678 ').ok).toBe(true);
  });

  test('빈 값과 잘못된 모양은 안내 문장을 준다', () => {
    expect(validatePhone('')).toEqual({ ok: false, message: '휴대폰 번호를 입력해 주세요.' });
    expect(validatePhone('0111234567').ok).toBe(false);
    expect(validatePhone('010-1234-5678').ok).toBe(false);
  });
});

describe('비밀번호', () => {
  test('10~64자면 통과한다', () => {
    expect(validatePassword('a'.repeat(10)).ok).toBe(true);
    expect(validatePassword('a'.repeat(64)).ok).toBe(true);
  });

  test('너무 짧거나 길면 막는다', () => {
    expect(validatePassword('a'.repeat(9)).ok).toBe(false);
    expect(validatePassword('a'.repeat(65)).ok).toBe(false);
    expect(validatePassword('').message).toBe('비밀번호를 입력해 주세요.');
  });

  test('확인란은 같은 값이어야 한다', () => {
    expect(validatePasswordConfirm('abcdefghij', 'abcdefghij').ok).toBe(true);
    expect(validatePasswordConfirm('abcdefghij', 'abcdefghik').message).toBe('비밀번호가 서로 달라요.');
    expect(validatePasswordConfirm('abcdefghij', '').ok).toBe(false);
  });
});

describe('닉네임', () => {
  test('한글·영문·숫자 2~12자는 통과한다', () => {
    expect(validateNickname('홍길동').ok).toBe(true);
    expect(validateNickname('Hong12').ok).toBe(true);
  });

  test('한 글자나 특수문자는 막는다', () => {
    expect(validateNickname('홍').ok).toBe(false);
    expect(validateNickname('홍길동!').ok).toBe(false);
    expect(validateNickname('').message).toBe('닉네임을 입력해 주세요.');
  });
});

describe('신체정보(난이도 추천용)', () => {
  test('범위 안이면 통과한다', () => {
    expect(validateFitnessProfile({ age: 30, heightCm: 175, weightKg: 70 }).ok).toBe(true);
  });

  test('범위를 벗어나면 어떤 값이 문제인지 알려 준다', () => {
    expect(validateFitnessProfile({ age: 12, heightCm: 175, weightKg: 70 }).message).toBe(
      '나이는 13~100 사이여야 해요.',
    );
    expect(validateFitnessProfile({ age: 30, heightCm: 99, weightKg: 70 }).message).toBe(
      '키는 100~250 사이여야 해요.',
    );
    expect(validateFitnessProfile({ age: 30, heightCm: 175, weightKg: 301 }).ok).toBe(false);
  });

  test('숫자가 아니거나 나이가 소수면 막는다', () => {
    expect(validateFitnessProfile({ age: 'abc', heightCm: 175, weightKg: 70 }).ok).toBe(false);
    expect(validateFitnessProfile({ age: 30.5, heightCm: 175, weightKg: 70 }).message).toBe(
      '나이는 정수로 입력해 주세요.',
    );
  });
});
