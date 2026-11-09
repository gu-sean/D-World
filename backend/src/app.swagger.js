import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** 개발·테스트 환경 전용 API 문서 (/docs), 운영에서는 호출하지 않음 */
export function setupSwagger(app) {
  const config = new DocumentBuilder()
    .setTitle('D-World Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
