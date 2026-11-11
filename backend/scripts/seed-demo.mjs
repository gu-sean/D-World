// 시연용 가상 데이터: 시연 사용자 1명이 앱 기능을 한 번씩 쓴 상태를 실제 API·서비스로 만든다
// (원장·캐시·트리거 정합성을 직접 SQL로 맞추지 않고 앱 로직을 그대로 통과시키기 위함)
// 선행: 마이그레이션 + 개발 시드(001·002) 적용, `npm run build`로 dist 생성
// 사용: DEMO_USER_PASSWORD=... DATABASE_URL=... node scripts/seed-demo.mjs
//   (npm run db:seed:demo 는 build까지 함께 실행)
// 재실행 안전: 시연 사용자가 이미 있으면 아무것도 하지 않음
// 로그인: 휴대폰 01000000002 / DEMO_USER_PASSWORD
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';

// 외부 호출·정기 작업이 끼지 않게 고정 (앱 모듈이 import 시점에 환경 변수를 검증하므로 import 전에 설정)
process.env.JOBS_DISABLED = 'true';
process.env.STORAGE_DRIVER = 'memory';
process.env.WEATHER_DRIVER = 'mock';
process.env.NODE_ENV ??= 'development';
// AI 판정 결과 수신 경로(시연에서는 AI 서버 대신 이 경로로 판정을 넣음)
process.env.INTERNAL_API_TOKEN ??= `demo-internal-token-${'0'.repeat(24)}`;

const password = process.env.DEMO_USER_PASSWORD;
if (!password || !process.env.DATABASE_URL) {
  console.error(
    '사용: DEMO_USER_PASSWORD=... DATABASE_URL=... node scripts/seed-demo.mjs',
  );
  process.exit(1);
}

const ADMIN_ID = 'd0000000-0000-4000-8000-000000000001'; // 001 시드의 dev_admin
const USER_ID = 'd0000000-0000-4000-8000-000000000801';
const PHONE = '+821000000002';
const CHALLENGE_ID = 'd0000000-0000-4000-8000-000000000701'; // 002 시드의 공개 챌린지
const SPECIES_ID = 'd0000000-0000-4000-8000-000000000101'; // 002 시드의 꾸준냥이

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp, registerNotFoundFallback } =
  await import('../dist/app.setup.js');
const { DatabaseService } =
  await import('../dist/database/database.service.js');
const { SessionsService } =
  await import('../dist/common/auth/sessions.service.js');
const { AccessTokenService } =
  await import('../dist/common/auth/access-token.service.js');
const { PointsService } = await import('../dist/points/points.service.js');
const { WeatherStoreService } =
  await import('../dist/recommendations/weather-store.service.js');
const { kstDate, addDays } = await import('../dist/common/time/kst.js');

const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn'],
});
configureApp(app);
await app.init();
registerNotFoundFallback(app);
const http = request(app.getHttpServer());
const db = app.get(DatabaseService);

const log = (message) => console.log(`✔ ${message}`);
let userToken;
let adminToken;

const call = (method, path, token, body, { expect: status } = {}) => {
  const req = http[method](path).set('Authorization', `Bearer ${token}`);
  if (method !== 'get') req.set('Idempotency-Key', randomUUID());
  return (body === undefined ? req : req.send(body)).then((res) => {
    if (status !== undefined && res.status !== status) {
      throw new Error(
        `${method.toUpperCase()} ${path} → ${res.status} (기대 ${status}): ${JSON.stringify(res.body)}`,
      );
    }
    return res.body;
  });
};
const asUser = (method, path, body, status) =>
  call(method, path, userToken, body, { expect: status });
const asAdmin = (method, path, body, status) =>
  call(method, path, adminToken, body, { expect: status });

/** AI 서버가 보내는 판정 결과를 대신 넣는다 (POST /internal/v1/ai-callbacks/verification-results) */
async function aiVerdict(recordId, decision, reason, metrics) {
  const res = await http
    .post('/internal/v1/ai-callbacks/verification-results')
    .set('x-internal-token', process.env.INTERNAL_API_TOKEN)
    .send({
      ingestKey: `demo:${recordId}`,
      recordId,
      decision,
      engineVersion: 'demo-model@1',
      confidence: 0.94,
      metrics,
      reason,
      rawResult: { source: 'demo' },
    });
  if (![200, 201].includes(res.status)) {
    throw new Error(`AI 판정 수신 ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

async function issueToken(kind, id) {
  const session = await db.withTransaction((tx) =>
    app.get(SessionsService).create(tx, kind, id),
  );
  return app.get(AccessTokenService).issue(kind, id, session.sessionId);
}

try {
  // ---------- 선행 조건 ----------
  const admin = await db.query('SELECT 1 FROM admin_accounts WHERE id = $1', [
    ADMIN_ID,
  ]);
  const catalog = await db.query(
    "SELECT count(*)::int AS n FROM goal_categories WHERE code = 'exercise'",
  );
  if (admin.rowCount === 0 || catalog.rows[0].n === 0) {
    throw new Error(
      '개발 시드(db/seeds/dev 001·002)가 먼저 적용되어 있어야 함 (npm run db:seed)',
    );
  }
  const existing = await db.query(
    'SELECT 1 FROM phone_credentials WHERE phone_e164 = $1',
    [PHONE],
  );
  if (existing.rowCount > 0) {
    console.log('시연 사용자가 이미 있어 건너뜀');
    process.exit(0);
  }

  // ---------- 1. 계정 ----------
  const hash = await argon2.hash(password);
  await db.withTransaction(async (tx) => {
    await tx.query('INSERT INTO users (id) VALUES ($1)', [USER_ID]);
    await tx.query(
      `INSERT INTO profiles (user_id, nickname, notification_enabled)
       VALUES ($1, '시연유저', true)`,
      [USER_ID],
    );
    await tx.query(
      `INSERT INTO phone_credentials
              (user_id, phone_e164, password_hash, verified_at, password_changed_at)
       VALUES ($1, $2, $3, now(), now())`,
      [USER_ID, PHONE, hash],
    );
    await tx.query(
      `INSERT INTO user_identities (id, user_id, provider, provider_subject, email)
       VALUES ($1, $2, 'google', 'demo-google-subject', 'demo@example.test')`,
      [randomUUID(), USER_ID],
    );
    await tx.query(
      `INSERT INTO consent_records (id, user_id, document_version_id, granted)
       SELECT gen_random_uuid(), $1, p.id, true
         FROM policy_document_versions p WHERE p.version = 'dev-1'`,
      [USER_ID],
    );
    await tx.query('INSERT INTO point_wallets (user_id) VALUES ($1)', [
      USER_ID,
    ]);
    await tx.query(
      `INSERT INTO user_experience (user_id, level_policy_version_id)
       SELECT $1, id FROM user_level_policy_versions WHERE version_no = 1`,
      [USER_ID],
    );
    await tx.query('INSERT INTO streak_states (user_id) VALUES ($1)', [
      USER_ID,
    ]);
  });
  userToken = await issueToken('user', USER_ID);
  adminToken = await issueToken('admin', ADMIN_ID);
  log('계정: 시연유저(휴대폰 로그인·구글 연결·약관 동의)');

  await asUser(
    'put',
    '/api/v1/me/push-devices',
    { platform: 'android', token: 'demo-push-token-0001' },
    200,
  );
  log('푸시 기기 1대 등록');

  // ---------- 2. 펫 ----------
  const pet = await asUser(
    'post',
    '/api/v1/me/pets',
    { speciesId: SPECIES_ID, nickname: '모모', makeRepresentative: true },
    201,
  );
  log(`펫: 꾸준냥이 "${pet.nickname ?? '모모'}" 선택, 대표 설정`);

  // ---------- 3. 목표·단계 ----------
  const today = kstDate();
  const goal = await asUser(
    'post',
    '/api/v1/goals',
    {
      title: '한 달 운동 습관 만들기',
      description: '매일 조금씩 운동하기',
      categoryCode: 'exercise',
      difficultyCode: 'normal',
      startDate: today,
      endDate: addDays(today, 30),
      targetFrequency: 5,
      dailyAvailableMinutes: 30,
    },
    201,
  );
  await asUser(
    'post',
    `/api/v1/goals/${goal.id}/steps`,
    {
      title: '1주차: 몸 풀기',
      description: '가벼운 운동으로 시작',
      dueDate: addDays(today, 7),
    },
    201,
  );
  log('목표 1개(활성) + 단계 1개');

  // ---------- 4. 미션 3개 ----------
  const sensorMission = (title, target) => ({
    title,
    categoryCode: 'exercise',
    difficultyCode: 'normal',
    exerciseCode: 'running',
    verificationMethod: 'sensor',
    targetValue: target,
    targetUnit: 'meters',
    scheduledDate: today,
    goalId: goal.id,
  });
  const approvedMission = await asUser(
    'post',
    '/api/v1/missions',
    sensorMission('러닝 2km', 2000),
    201,
  );
  const rejectedMission = await asUser(
    'post',
    '/api/v1/missions',
    sensorMission('러닝 3km', 3000),
    201,
  );
  await asUser(
    'post',
    '/api/v1/missions',
    {
      title: '스쿼트 20개',
      categoryCode: 'exercise',
      difficultyCode: 'normal',
      exerciseCode: 'squat',
      verificationMethod: 'camera',
      targetValue: 20,
      targetUnit: 'reps',
      scheduledDate: today,
      goalId: goal.id,
    },
    201,
  );
  log(
    '미션 3개: 러닝 2km(승인 예정)·러닝 3km(거절 예정)·스쿼트 20개(대기, 시연용)',
  );

  // ---------- 5. 인증: 승인 1건, 거절 1건 + 이의 제기 ----------
  const submitSensor = async (missionId, distanceMeters) => {
    const record = await asUser(
      'post',
      `/api/v1/missions/${missionId}/records`,
      undefined,
      201,
    );
    await asUser(
      'post',
      `/api/v1/mission-records/${record.id}/submit`,
      {
        evidenceKind: 'sensor_raw',
        clientMetrics: { distanceMeters, durationSeconds: 960 },
      },
      202,
    );
    return record.id;
  };
  const approvedRecord = await submitSensor(approvedMission.id, 2300);
  await aiVerdict(approvedRecord, 'approved', '목표 거리 충족', {
    distanceMeters: 2300,
  });
  log('인증 승인: 포인트·경험치·스트릭 지급까지 반영');

  const rejectedRecord = await submitSensor(rejectedMission.id, 1200);
  await aiVerdict(rejectedRecord, 'rejected', '목표 거리 미달', {
    distanceMeters: 1200,
  });
  const rejected = await asUser(
    'get',
    `/api/v1/mission-records/${rejectedRecord}`,
    undefined,
    200,
  );
  await asUser(
    'post',
    `/api/v1/verification-results/${rejected.currentResult.id}/appeals`,
    { reason: '중간에 신호가 끊겨 거리가 덜 잡혔어요. 다시 확인 부탁드려요.' },
    201,
  );
  log('인증 거절 1건 + 이의 제기 1건');

  // ---------- 6. 두 번째 목표를 완료해 업적 ----------
  const first = await asUser(
    'post',
    '/api/v1/goals',
    {
      title: '첫 걸음',
      categoryCode: 'lifestyle',
      difficultyCode: 'easy',
      startDate: today,
      endDate: addDays(today, 7),
    },
    201,
  );
  await asUser('post', `/api/v1/goals/${first.id}/complete`, undefined, 200);
  log('목표 완료 → 업적 "첫 목표 달성" 획득');

  // ---------- 7. 포인트 지급 후 상점 주문 ----------
  await db.withTransaction((tx) =>
    app.get(PointsService).manualAdjust(tx, {
      adminId: ADMIN_ID,
      userId: USER_ID,
      kind: 'manual_grant',
      amount: 500,
      reason: '시연용 포인트 지급',
    }),
  );
  await asUser(
    'post',
    '/api/v1/shop/orders',
    { itemId: 'd0000000-0000-4000-8000-000000000401', quantity: 1 },
    201,
  );
  log('포인트 500P 지급 → 펫 간식 1개 구매(인벤토리 반영)');

  // ---------- 8. 챌린지 참여 ----------
  await asUser(
    'post',
    `/api/v1/challenges/${CHALLENGE_ID}/participations`,
    undefined,
    201,
  );
  log('챌린지 "7일 스쿼트 챌린지" 참여');

  // ---------- 9. 공지 → 알림 ----------
  const notice = await asAdmin(
    'post',
    '/admin/v1/notices',
    {
      category: 'service',
      title: '시연 공지: D-World에 오신 걸 환영해요',
      body: '오늘의 미션을 확인하고 펫과 함께 성장해 보세요.',
      audienceType: 'users',
      showInList: true,
      sendPush: true,
      userIds: [USER_ID],
      reason: '시연 공지 등록',
    },
    201,
  );
  await asAdmin(
    'post',
    `/admin/v1/notices/${notice.id}/publish`,
    { scheduledAt: null, reason: '시연 공지 게시' },
    200,
  );
  log('공지 1건 게시 → 시연유저 알림 1건');

  // ---------- 10. 문의 ----------
  await asUser(
    'post',
    '/api/v1/me/support-tickets',
    {
      ticketType: 'inquiry',
      category: 'mission',
      subject: '시연 문의',
      body: '미션 시간을 바꿀 수 있나요?',
    },
    201,
  );
  log('문의 1건 접수');

  // ---------- 11. 날씨(시간별 저장)·상황 추천 ----------
  await app
    .get(WeatherStoreService)
    .save({ nx: 60, ny: 127 }, { weather: 'clear', temperatureC: 12 });
  await asUser(
    'post',
    '/api/v1/recommendations/situational',
    { kind: 'weather', latitude: 37.5665, longitude: 126.978 },
    201,
  );
  log('서울 격자(60,127) 시간별 날씨 1건 + 상황 추천 1건');

  // ---------- 12. 주간 AI 리포트 ----------
  const runId = randomUUID();
  const monday = addDays(
    today,
    -(((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 7),
  );
  await db.withTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO ai_analysis_runs (id, user_id, run_type, period_start, period_end)
       VALUES ($1, $2, 'weekly_report', $3::date, $3::date + 6)`,
      [runId, USER_ID, monday],
    );
    // 결과는 열린(requested) 실행에만 붙일 수 있어 먼저 넣고 실행을 완료한다
    await tx.query(
      `INSERT INTO ai_reports (run_id, run_type, user_id, title, summary, content_json, feedback)
       VALUES ($1, 'weekly_report', $2, '지난주 리포트',
               '시연용 가상 리포트입니다. 꾸준히 운동한 한 주였어요.',
               '{"highlights":["러닝 2회","스트릭 시작"]}',
               '아침 시간대에 성공률이 높아요')`,
      [runId, USER_ID],
    );
    await tx.query(
      `UPDATE ai_analysis_runs
          SET status = 'completed', engine_version = 'demo@1', completed_at = now()
        WHERE id = $1`,
      [runId],
    );
  });
  log('주간 AI 리포트 1건(가상)');

  console.log('\n시연 데이터 생성 완료');
  console.log(`  로그인: 휴대폰 01000000002 / DEMO_USER_PASSWORD`);
} catch (error) {
  console.error(`\n시연 데이터 생성 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
