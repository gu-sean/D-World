import { jest } from '@jest/globals';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../../../../src/common/errors/all-exceptions.filter.js';
import { AppException } from '../../../../src/common/errors/app-exception.js';
import {
  replacedMessage,
  toErrorBody,
} from '../../../../src/common/errors/error-response.js';

const badRequest = (message) =>
  new AppException(HttpStatus.BAD_REQUEST, 'bad_request', message);

describe('replacedMessage', () => {
  it('400의 던진 문구가 고정 문구로 바뀌면 원문을 돌려줌', () => {
    const exception = badRequest('categoryId와 difficultyId가 필요함');
    const body = toErrorBody(exception);
    // 응답에는 표의 고정 문구만 나감
    expect(body.error.message).toBe('입력한 내용을 다시 확인해 주세요.');
    expect(replacedMessage(exception, body)).toBe(
      'categoryId와 difficultyId가 필요함',
    );
  });

  it('표에 없는 도메인 코드는 던진 문구가 그대로 나가므로 null', () => {
    const exception = new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'step_has_history',
      '기록이 있는 단계는 삭제할 수 없음',
    );
    const body = toErrorBody(exception);
    expect(body.error.message).toBe('기록이 있는 단계는 삭제할 수 없음');
    expect(replacedMessage(exception, body)).toBeNull();
  });

  it('코드가 없는 프레임워크 예외(404 없는 경로 등)는 null', () => {
    const exception = new NotFoundException('Cannot GET /nope');
    expect(replacedMessage(exception, toErrorBody(exception))).toBeNull();
  });

  it('입력 검사 배열은 details.fields로 이미 전달되므로 null', () => {
    const exception = new BadRequestException(['title: 값이 필요함']);
    expect(replacedMessage(exception, toErrorBody(exception))).toBeNull();
  });

  it('HttpException이 아니면 null', () => {
    expect(replacedMessage(new Error('boom'), toErrorBody(new Error()))).toBe(
      null,
    );
  });
});

describe('AllExceptionsFilter 4xx 로그', () => {
  function setup() {
    const reply = jest.fn();
    const httpAdapter = {
      getRequestUrl: () => '/api/v1/missions',
      getRequestMethod: () => 'POST',
      reply,
    };
    const filter = new AllExceptionsFilter({ httpAdapter });
    filter.logger = { warn: jest.fn(), error: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'req-12345678' }),
        getResponse: () => ({}),
      }),
    };
    return { filter, host, reply };
  }

  it('사라진 원문은 warn 한 줄로 남기고 응답은 그대로(고정 문구, details null)', () => {
    const { filter, host, reply } = setup();
    filter.catch(
      badRequest('targetValue와 targetUnit은 함께 지정해야 함'),
      host,
    );

    expect(filter.logger.warn).toHaveBeenCalledTimes(1);
    const line = filter.logger.warn.mock.calls[0][0];
    expect(line).toContain('POST /api/v1/missions -> 400');
    expect(line).toContain('COMMON_VALIDATION_FAILED');
    expect(line).toContain('targetValue와 targetUnit은 함께 지정해야 함');
    expect(line).toContain('requestId=req-12345678');
    expect(filter.logger.error).not.toHaveBeenCalled();
    // 응답 계약은 바뀌지 않음
    expect(reply).toHaveBeenCalledWith(
      {},
      {
        error: {
          code: 'COMMON_VALIDATION_FAILED',
          message: '입력한 내용을 다시 확인해 주세요.',
          details: null,
        },
      },
      400,
    );
  });

  it('원문이 사라지지 않은 4xx와 프레임워크 404는 로그하지 않음', () => {
    const { filter, host } = setup();
    filter.catch(new NotFoundException('Cannot GET /nope'), host);
    filter.catch(
      new AppException(HttpStatus.CONFLICT, 'conflict', '이미 있어요'),
      host,
    );
    expect(filter.logger.warn).not.toHaveBeenCalled();
    expect(filter.logger.error).not.toHaveBeenCalled();
  });

  it('5xx는 기존대로 error 로그', () => {
    const { filter, host } = setup();
    filter.catch(new Error('boom'), host);
    expect(filter.logger.error).toHaveBeenCalledTimes(1);
    expect(filter.logger.warn).not.toHaveBeenCalled();
  });
});
