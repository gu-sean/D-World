import { Catch, Dependencies, HttpException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  isBodyParserError,
  replacedMessage,
  toErrorBody,
} from './error-response.js';

@Catch()
@Dependencies(HttpAdapterHost)
export class AllExceptionsFilter {
  logger = new Logger(AllExceptionsFilter.name);

  constructor(adapterHost) {
    this.adapterHost = adapterHost;
  }

  catch(exception, host) {
    const { httpAdapter } = this.adapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest();
    const path = httpAdapter.getRequestUrl(request);
    const body = toErrorBody(exception);

    // 4xx HttpException은 로그 제외, 그 외(DB 제약 포함)는 원인을 서버 로그에만 기록
    const isClientError =
      (exception instanceof HttpException && body.statusCode < 500) ||
      isBodyParserError(exception);
    if (!isClientError) {
      const detail =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `${httpAdapter.getRequestMethod(request)} ${path} -> ${body.statusCode}`,
        detail,
      );
    } else {
      // 4xx는 로그를 남기지 않되, 입력 검증 오류(COMMON_VALIDATION_FAILED)의 던진 문구가
      // 응답의 고정 문구로 바뀌어 사라진 경우만 원문을 기록 (409 충돌 같은 정상 흐름은 제외)
      const original = replacedMessage(exception, body);
      if (original && body.error.code === 'COMMON_VALIDATION_FAILED') {
        this.logger.warn(
          `${httpAdapter.getRequestMethod(request)} ${path} -> ${body.statusCode} ${body.error.code}: ${original} (requestId=${request?.id ?? '-'})`,
        );
      }
    }

    httpAdapter.reply(
      context.getResponse(),
      { error: body.error },
      body.statusCode,
    );
  }
}
