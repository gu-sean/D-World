import { BadRequestException, NotFoundException } from '@nestjs/common';
import pg from 'pg';
import { toErrorBody } from '../../../../src/common/errors/error-response.js';
function pgError(code) {
  const err = new pg.DatabaseError('원본 메시지', 0, 'error');
  err.code = code;
  return err;
}
describe('toErrorBody', () => {
  it('HttpException은 상태·코드 유지', () => {
    expect(toErrorBody(new NotFoundException('없음'))).toEqual({
      statusCode: 404,
      error: {
        code: 'COMMON_NOT_FOUND',
        message: '찾을 수 없어요.',
        details: null,
      },
    });
  });
  it('검증 오류는 details.fields로 전달', () => {
    const body = toErrorBody(
      new BadRequestException(['a: 값이 필요함', 'b: 숫자여야 함']),
    );
    expect(body.statusCode).toBe(400);
    expect(body.error.code).toBe('COMMON_VALIDATION_FAILED');
    expect(body.error.details).toEqual({
      fields: { a: '값이 필요함', b: '숫자여야 함' },
    });
  });
  it('관리자 reason 누락은 ADMIN_REASON_REQUIRED', () => {
    const body = toErrorBody(new BadRequestException(['reason: 값이 필요함']));
    expect(body.error.code).toBe('ADMIN_REASON_REQUIRED');
  });
  it.each([
    ['23505', 409],
    ['23503', 409],
    ['23502', 422],
    ['23514', 422],
    ['40001', 503],
    ['40P01', 503],
  ])('SQLSTATE %s → %i', (code, status) => {
    expect(toErrorBody(pgError(code)).statusCode).toBe(status);
  });
  it('DB 원문 메시지는 응답에서 제외', () => {
    expect(JSON.stringify(toErrorBody(pgError('23505')))).not.toContain(
      '원본 메시지',
    );
  });
  it('알 수 없는 오류는 500', () => {
    expect(toErrorBody(new Error('boom'))).toEqual({
      statusCode: 500,
      error: {
        code: 'COMMON_INTERNAL',
        message: '잠시 후 다시 시도해 주세요.',
        details: null,
      },
    });
    expect(toErrorBody(pgError('XX000')).statusCode).toBe(500);
  });
});
