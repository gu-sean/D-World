import { configureApp, registerNotFoundFallback } from '../../src/app.setup.js';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)('HTTP (PostgreSQL)', () => {
  let app;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    registerNotFoundFallback(app);
  });
  afterAll(async () => {
    await app.close();
  });
  it('GET /health는 DB 연결 상태 반환', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({
      status: 'ok',
      database: 'up',
    });
  });
  it('GET /health/live는 DB 없이 생존만 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(res.body).toEqual({
      status: 'ok',
    });
  });
  it('없는 경로는 표준 오류 형식의 404', async () => {
    const res = await request(app.getHttpServer()).get('/없는경로').expect(404);
    expect(res.body).toEqual({
      error: {
        code: 'COMMON_NOT_FOUND',
        message: '찾을 수 없어요.',
        details: null,
      },
    });
  });
});
