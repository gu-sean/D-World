// 앱 모듈이 import 시점에 환경 변수를 검증하므로 테스트용 값을 미리 채운다.
// `||=`를 쓰는 이유: `.env`를 불러 쓰면 `.env.example`에서 복사한 빈 값(`INTERNAL_API_TOKEN=`)이나
// 운영용 값(`JOBS_DISABLED=false`)이 들어오는데, `??=`는 빈 문자열을 "값 있음"으로 봐서 덮어쓰지 못한다.
// 셸에서 값을 명시해 준 경우(예: JOBS_DISABLED=false)는 그대로 존중한다.
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-0123456789-abcdefghij';
process.env.ADMIN_JWT_SECRET ||= 'test-admin-secret-0123456789-klmnopqrst';
process.env.JOBS_DISABLED ||= 'true';
process.env.INTERNAL_API_TOKEN ||= 'test-ai-ingest-secret-0123456789-abcdef';
// .env의 실제 날씨 공급자·키가 테스트에 새어 들어가 외부 호출하지 않도록 고정(개별 테스트는 서비스에 가짜를 주입)
process.env.WEATHER_DRIVER = 'mock';
delete process.env.KMA_AUTH_KEY;
delete process.env.OPENWEATHER_API_KEY;
