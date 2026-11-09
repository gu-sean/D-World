import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { setupSwagger } from './app.swagger.js';
import { configureApp, registerNotFoundFallback } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApp(app);

  // 프록시 뒤에서만 X-Forwarded-For를 신뢰, 아니면 IP 제한이 헤더 조작으로 우회됨
  if (config.get('TRUST_PROXY')) app.set('trust proxy', 1);
  app.use(helmet());

  const origins = config
    .get('ADMIN_WEB_ORIGIN')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins?.length) app.enableCors({ origin: origins, credentials: true });
  if (config.get('NODE_ENV') !== 'production') setupSwagger(app);

  // 요청 검증은 컨트롤러의 common/validation.js 규칙 함수가 담당(DTO·ValidationPipe 미사용)
  // SIGTERM 시 요청 처리 후 DB 풀 종료
  app.enableShutdownHooks();

  // 없는 경로 404 처리가 init 이후 등록되므로 listen 전에 명시적으로 초기화
  await app.init();
  registerNotFoundFallback(app);
  await app.listen(config.get('PORT'));
}
await bootstrap();
