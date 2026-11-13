import { readIdempotencyKey } from '../../../../src/common/idempotency/admin-idempotency.service.js';
import { toErrorBody } from '../../../../src/common/errors/error-response.js';

const requestWith = (value) => ({
  headers: value === undefined ? {} : { 'idempotency-key': value },
});

/** 예외가 실제 응답으로 나갈 때의 모양 */
const responseOf = (value) => {
  try {
    readIdempotencyKey(requestWith(value));
  } catch (error) {
    return toErrorBody(error);
  }
  return null;
};

describe('readIdempotencyKey', () => {
  it('공백 없는 출력 가능 ASCII 8~128자는 그대로 통과 (UUID일 필요 없음)', () => {
    expect(readIdempotencyKey(requestWith('k-12345678'))).toBe('k-12345678');
    expect(readIdempotencyKey(requestWith('MslObBtL'))).toBe('MslObBtL');
    expect(readIdempotencyKey(requestWith('a'.repeat(128)))).toHaveLength(128);
  });

  it('헤더가 없으면 "헤더가 필요함"으로 안내', () => {
    for (const missing of [undefined, '']) {
      const response = responseOf(missing);
      expect(response.statusCode).toBe(400);
      expect(response.error.code).toBe('COMMON_VALIDATION_FAILED');
      expect(response.error.details).toEqual({
        fields: { 'Idempotency-Key': '헤더가 필요함' },
      });
    }
  });

  it('형식이 틀리면(짧음·김·공백·한글) "형식" 안내로 구분', () => {
    for (const wrong of [
      'short',
      'a'.repeat(129),
      'has space 1234',
      '한글키값입니다열자',
    ]) {
      const response = responseOf(wrong);
      expect(response.statusCode).toBe(400);
      expect(response.error.code).toBe('COMMON_VALIDATION_FAILED');
      expect(response.error.details.fields['Idempotency-Key']).toContain(
        '8~128자',
      );
    }
  });

  it('응답 코드·상태·고정 문구는 이전과 같고 details만 채워짐', () => {
    const response = responseOf('short');
    expect(response.error.message).toBe('입력한 내용을 다시 확인해 주세요.');
    expect(response.statusCode).toBe(400);
  });
});
