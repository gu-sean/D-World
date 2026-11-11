import { Catch, Dependencies, HttpException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { isBodyParserError, toErrorBody } from './error-response.js';

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
    }

    httpAdapter.reply(
      context.getResponse(),
      { error: body.error },
      body.statusCode,
    );
  }
}
