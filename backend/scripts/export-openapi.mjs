// OpenAPI 문서를 ../docs/openapi/backend.json 으로 내보냄 (먼저 npm run build 필요)
// DB에 연결하지 않고 라우트 정보만 읽음, 필요한 환경 변수는 .env 또는 호출 환경에서 읽음
import { mkdir, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/app.setup.js';

const app = await NestFactory.create(AppModule, { logger: ['error'] });
configureApp(app);
await app.init();
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('D-World Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build(),
);
const outDir = new URL('../../docs/openapi/', import.meta.url);
await mkdir(outDir, { recursive: true });
await writeFile(
  new URL('backend.json', outDir),
  `${JSON.stringify(document, null, 2)}\n`,
);
await app.close();
console.log('docs/openapi/backend.json 생성');
