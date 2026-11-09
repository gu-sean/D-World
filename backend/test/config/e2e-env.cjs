process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789-abcdefghij';
process.env.ADMIN_JWT_SECRET ??= 'test-admin-secret-0123456789-klmnopqrst';
process.env.JOBS_DISABLED ??= 'true';
process.env.INTERNAL_API_TOKEN ??= 'test-ai-ingest-secret-0123456789-abcdef';
// .env의 실제 날씨 공급자·키가 테스트에 새어 들어가 외부 호출하지 않도록 고정(개별 테스트는 서비스에 가짜를 주입)
process.env.WEATHER_DRIVER = 'mock';
delete process.env.KMA_AUTH_KEY;
delete process.env.OPENWEATHER_API_KEY;
