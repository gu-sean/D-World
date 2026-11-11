import { RequestMethod } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import { mobileCompatMiddleware } from './common/http/mobile-compat.middleware.js';
import { ERROR_CODES } from './common/errors/error-codes.js';

/**
 * 앱 공통 설정 (main.js·테스트 공용)
 * - 앱 API: /api/v1 (전역 접두어)
 * - 관리자 /admin/v1, 내부 /internal/v1: 컨트롤러가 접두어를 직접 가짐 → 전역 접두어 제외
 * - 헬스체크는 접두어 없이 유지(로드밸런서·compose 설정과 분리)
 */
export function configureApp(app) {
  // JSON 본문 상한 1MB(기본 100KB): 약관 본문 등 긴 글을 받기 위함, 초과는 413 표준 오류
  app.useBodyParser('json', { limit: '1mb' });
  app.use(requestIdMiddleware);
  app.use(mobileCompatMiddleware); // 모바일 클라이언트 경로 별칭
  app.use(cookieParser()); // 관리자 리프레시 쿠키
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*path}', method: RequestMethod.ALL },
      { path: 'admin/{*path}', method: RequestMethod.ALL },
      { path: 'internal/{*path}', method: RequestMethod.ALL },
    ],
  });

  return app;
}

/**
 * 없는 경로의 표준 오류 본문
 * 전역 접두어(/api/v1) 밖의 경로는 Nest 기본 404가 닿지 않아 Express 기본 HTML이 나가므로
 * 라우트 등록이 끝난 app.init() 직후 마지막 핸들러로 붙임
 */
export function registerNotFoundFallback(app) {
  const [status, message] = ERROR_CODES.COMMON_NOT_FOUND;
  app
    .getHttpAdapter()
    .getInstance()
    .use((request, response) => {
      response.status(status).json({
        error: { code: 'COMMON_NOT_FOUND', message, details: null },
      });
    });
}
