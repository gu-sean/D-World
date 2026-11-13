// 시연 DB에서 비어 있는 표를 채운다: 검수·정산·제재·탈퇴·회수·진화·재조정 같은 "상태가 더 바뀌어야 생기는" 데이터
// (원장·캐시·트리거 정합성을 직접 SQL로 맞추지 않고 앱 API·서비스를 그대로 통과시켜 만든다.
//  과거 날짜가 필요한 것(정산·연속 기록)만 e2e와 같은 방식으로 날짜를 되감는다)
//
// 선행: 마이그레이션 + 개발 시드(001·002) + 시험 계정(01099999999, npm run demo)이 있는 DB, `npm run build`로 dist 생성
// 사용: npm run demo:fill        (DATABASE_URL은 backend/.env)
//   재실행 안전: 단계마다 "그 단계가 만드는 표가 이미 차 있으면" 건너뛴다
//
// 계정을 제한하는 데이터(제재·탈퇴 요청 등)는 시험 계정이 아니라 별도 시연 사용자(아래 DEMO_USERS)에게만 만든다.
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';

// 외부 호출·정기 작업이 끼지 않게 고정 (앱 모듈이 import 시점에 환경 변수를 검증하므로 import 전에 설정)
process.env.JOBS_DISABLED = 'true';
process.env.STORAGE_DRIVER = 'memory';
process.env.WEATHER_DRIVER = 'mock';
process.env.SOCIAL_DRIVER = 'mock'; // 소셜 계정 연결을 가짜 토큰으로 하기 위함(개발 전용)
process.env.NODE_ENV ??= 'development';
process.env.INTERNAL_API_TOKEN ||= `demo-internal-token-${'0'.repeat(24)}`;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 이 필요해요 (backend/.env)');
  process.exit(1);
}

const ADMIN_ID = 'd0000000-0000-4000-8000-000000000001'; // 001 시드의 dev_admin
const MAIN_PHONE = '+821099999999'; // 시험 계정
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? '1234567890';
// 상태를 바꿔 두는 별도 시연 사용자 (시험 계정은 그대로 두려고 따로 둔다)
const DEMO_USERS = {
  sanction: { phone: '+821011110001', nickname: '제재시연' },
  withdraw: { phone: '+821011110002', nickname: '탈퇴요청시연' },
};

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
const { kstDate, addDays } = await import('../dist/common/time/kst.js');
const { OBJECT_STORAGE } =
  await import('../dist/media/storage/object-storage.js');

const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn'],
});
configureApp(app);
await app.init();
registerNotFoundFallback(app);
const http = request(app.getHttpServer());
const db = app.get(DatabaseService);

const log = (message) => console.log(`✔ ${message}`);
const skip = (message) => console.log(`- ${message}`);
const results = []; // { step, filled: [표...], note }

/** 요청 한 번. status를 주면 다르면 오류를 던진다 */
const call = (method, path, token, body, { expect: status, headers } = {}) => {
  const req = http[method](path).set('Authorization', `Bearer ${token}`);
  if (method !== 'get') req.set('Idempotency-Key', randomUUID());
  for (const [key, value] of Object.entries(headers ?? {})) req.set(key, value);
  return (body === undefined ? req : req.send(body)).then((res) => {
    if (status !== undefined && res.status !== status) {
      throw new Error(
        `${method.toUpperCase()} ${path} → ${res.status} (기대 ${status}): ${JSON.stringify(res.body)}`,
      );
    }
    return res.body;
  });
};
const asUser = (token) => ({
  get: (path, status) =>
    call('get', path, token, undefined, { expect: status }),
  post: (path, body, status) =>
    call('post', path, token, body, { expect: status }),
  put: (path, body, status) =>
    call('put', path, token, body, { expect: status }),
  patch: (path, body, status) =>
    call('patch', path, token, body, { expect: status }),
});

async function issueToken(kind, id) {
  const session = await db.withTransaction((tx) =>
    app.get(SessionsService).create(tx, kind, id),
  );
  return app.get(AccessTokenService).issue(kind, id, session.sessionId);
}

/** 트리거를 끄고(session_replication_role=replica) 한 문장 실행: 날짜 되감기 전용 (e2e와 같은 방식) */
const bypass = (sql, params) =>
  db.withTransaction(async (tx) => {
    await tx.query('SET LOCAL session_replication_role = replica');
    await tx.query(sql, params);
  });

const count = async (table) =>
  Number((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n);

/**
 * 한 단계를 실행한다. tables가 모두 이미 차 있으면 건너뛴다.
 * 실패해도 다음 단계로 넘어가고, 끝에 어떤 표가 채워졌는지 요약한다.
 */
async function step(name, tables, fn) {
  const before = {};
  for (const table of tables) before[table] = await count(table);
  if (tables.every((table) => before[table] > 0)) {
    skip(`${name}: 이미 채워져 있어 건너뜀`);
    results.push({ name, tables, state: 'skipped', filled: [], empty: [] });
    return;
  }
  try {
    await fn();
    const filled = [];
    const empty = [];
    for (const table of tables) {
      ((await count(table)) > before[table] ? filled : empty).push(table);
    }
    results.push({
      name,
      tables,
      state: empty.length ? 'partial' : 'done',
      filled,
      empty,
    });
    log(
      `${name}: ${filled.length ? `채움 ${filled.join(', ')}` : '추가 없음'}${empty.length ? ` / 비어 있음 ${empty.join(', ')}` : ''}`,
    );
  } catch (error) {
    results.push({
      name,
      tables,
      state: 'failed',
      filled: [],
      empty: tables,
      error: error.message,
    });
    console.error(`✖ ${name} 실패: ${error.message}`);
  }
}

/** 별도 시연 사용자를 만든다(이미 있으면 그 사용자). seed-demo와 같은 방식으로 계정 관련 행을 직접 넣는다 */
async function ensureUser({ phone, nickname }) {
  const found = await db.query(
    'SELECT user_id FROM phone_credentials WHERE phone_e164 = $1',
    [phone],
  );
  if (found.rowCount > 0) return found.rows[0].user_id;
  const id = randomUUID();
  const hash = await argon2.hash(DEMO_PASSWORD);
  await db.withTransaction(async (tx) => {
    await tx.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await tx.query(
      `INSERT INTO profiles (user_id, nickname, notification_enabled) VALUES ($1, $2, true)`,
      [id, nickname],
    );
    await tx.query(
      `INSERT INTO phone_credentials (user_id, phone_e164, password_hash, verified_at, password_changed_at)
       VALUES ($1, $2, $3, now(), now())`,
      [id, phone, hash],
    );
    await tx.query(
      `INSERT INTO consent_records (id, user_id, document_version_id, granted)
       SELECT gen_random_uuid(), $1, p.id, true FROM policy_document_versions p WHERE p.version = 'dev-1'`,
      [id],
    );
    await tx.query('INSERT INTO point_wallets (user_id) VALUES ($1)', [id]);
    await tx.query(
      `INSERT INTO user_experience (user_id, level_policy_version_id)
       SELECT $1, id FROM user_level_policy_versions ORDER BY effective_at DESC LIMIT 1`,
      [id],
    );
    await tx.query('INSERT INTO streak_states (user_id) VALUES ($1)', [id]);
  });
  return id;
}

try {
  // ---------- 선행 조건 ----------
  const main = await db.query(
    'SELECT user_id FROM phone_credentials WHERE phone_e164 = $1',
    [MAIN_PHONE],
  );
  const admin = await db.query('SELECT 1 FROM admin_accounts WHERE id = $1', [
    ADMIN_ID,
  ]);
  if (main.rowCount === 0 || admin.rowCount === 0) {
    throw new Error(
      '시험 계정(01099999999)과 개발 관리자가 있는 DB가 필요해요. 먼저 npm run demo 로 시연 덤프를 복원하세요.',
    );
  }
  const MAIN_ID = main.rows[0].user_id;
  const mainToken = await issueToken('user', MAIN_ID);
  const adminToken = await issueToken('admin', ADMIN_ID);
  const user = asUser(mainToken);
  const adminApi = asUser(adminToken);

  // ---------- 문의 처리 ----------
  await step('문의 처리', ['support_ticket_resolutions'], async () => {
    const tickets = await user.get('/api/v1/me/support-tickets', 200);
    const ticket = (tickets.items ?? tickets)[0];
    if (!ticket)
      throw new Error(
        '시험 계정에 문의가 없어요 (npm run demo 의 덤프에는 1건이 있어요)',
      );
    await adminApi.post(`/admin/v1/support-tickets/${ticket.id}/assign`, {
      reason: '시연 문의 담당 지정',
    });
    await adminApi.post(
      `/admin/v1/support-tickets/${ticket.id}/resolution`,
      {
        outcome: 'reply_only',
        userReply:
          '문의 주셔서 감사합니다. 미션 시간은 미션 수정에서 바꿀 수 있어요.',
        reason: '시연 문의 답변',
      },
      200,
    );
  });

  // ---------- 이용 제한 ----------
  await step('이용 제한', ['account_actions'], async () => {
    const sanctionId = await ensureUser(DEMO_USERS.sanction);
    await adminApi.post(
      `/admin/v1/users/${sanctionId}/account-actions`,
      { actionType: 'warning', reason: '시연: 부적절한 닉네임 경고' },
      201,
    );
    await adminApi.post(
      `/admin/v1/users/${sanctionId}/account-actions`,
      {
        actionType: 'restriction',
        days: 7,
        reason: '시연: 반복 신고로 7일 이용 제한',
      },
      201,
    );
  });

  // ---------- 탈퇴 요청 ----------
  await step('탈퇴 요청', ['account_withdrawal_requests'], async () => {
    const withdrawId = await ensureUser(DEMO_USERS.withdraw);
    const token = await issueToken('user', withdrawId);
    const made = await asUser(token).post(
      '/api/v1/me/withdrawal-requests',
      undefined,
      202,
    );
    // 관리자가 보류 처리 (처리 시작(processing)은 계정을 지우는 작업을 시작하므로 하지 않음)
    await adminApi.patch(
      `/admin/v1/withdrawal-requests/${made.requestId}`,
      { status: 'on_hold', reason: '시연: 환불 문의 확인 중이라 보류' },
      200,
    );
  });

  // ---------- 소셜 계정 연결 ----------
  await step('소셜 계정 연결', ['user_identities'], async () => {
    await user.post(
      '/api/v1/me/identities/google',
      { token: 'mock:demo-google-subject:demo@example.test' },
      204,
    );
  });

  // 분야·난이도 id (이후 단계에서 공통으로 씀)
  const categoryId = (
    await db.query("SELECT id FROM goal_categories WHERE code = 'exercise'")
  ).rows[0].id;
  const difficultyId = (
    await db.query("SELECT id FROM difficulty_levels WHERE code = 'normal'")
  ).rows[0].id;

  // ---------- 미션 정의 공개 검수 ----------
  await step(
    '미션 정의 공개 검수',
    ['mission_publication_reviews'],
    async () => {
      const definition = await user.post(
        '/api/v1/me/mission-definitions',
        {
          title: '아침 스트레칭 5분',
          description: '일어나서 가볍게 몸을 풀어요',
          categoryId,
          difficultyId,
          verificationMethod: 'camera',
          targetValue: 5,
          targetUnit: 'minutes',
          estimatedDurationSeconds: 300,
        },
        201,
      );
      await user.post(
        `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        undefined,
        200,
      );
      await adminApi.post(
        `/admin/v1/mission-definitions/${definition.id}/reviews`,
        { decision: 'approved', reason: '시연: 내용이 명확해 공개 승인' },
        200,
      );
    },
  );

  // ---------- 업적 생성(공개 → 과거 활동 백필 요청) + 관리자 이미지 업로드 ----------
  await step(
    '업적 생성·이미지 업로드',
    ['admin_asset_uploads', 'achievement_backfill_runs'],
    async () => {
      const achievementId = randomUUID();
      const ticket = await adminApi.post(
        '/admin/v1/assets/upload-urls',
        {
          assetKind: 'badge',
          ownerId: achievementId,
          mimeType: 'image/png',
          sizeBytes: 2048,
          reason: '시연 배지 이미지 업로드',
        },
        201,
      );
      const assetId = ticket.assetId ?? ticket.id;
      const row = (
        await db.query(
          'SELECT object_key FROM admin_asset_uploads WHERE id = $1',
          [assetId],
        )
      ).rows[0];
      // 메모리 저장소라 클라이언트의 실제 업로드를 흉내 낸다 (e2e와 같은 방식)
      app.get(OBJECT_STORAGE).simulateUpload(row.object_key, {
        size: 2048,
        contentType: 'image/png',
      });
      await adminApi.post(
        `/admin/v1/assets/${assetId}/complete`,
        undefined,
        200,
      );
      await adminApi.post(
        '/admin/v1/achievements',
        {
          code: 'demo_ten_missions',
          title: '열 번의 걸음',
          description: '미션 인증을 10번 승인받았어요',
          rarity: 'rare',
          conditionType: 'approved_mission_count',
          targetCount: 10,
          rewardPoints: 100,
          rewardUserXp: 50,
          rewardPetXp: 30,
          badgeAssetId: assetId,
          status: 'public',
          effectiveAt: new Date().toISOString(),
          reason: '시연 업적 공개',
        },
        201,
      );
    },
  );

  // ---------- 계획 재조정 제안 (AI 서버 없이 콜백 경로로) ----------
  await step('계획 재조정 제안', ['plan_adjustment_proposals'], async () => {
    const goals = await user.get('/api/v1/goals?status=active', 200);
    const goal =
      (goals.items ?? goals).find((item) => item.hasAcceptedPlan) ??
      (goals.items ?? goals)[0];
    if (!goal) throw new Error('시험 계정에 활성 목표가 없어요');
    const runId = randomUUID();
    const ingestKey = `plan-adjust:${runId}:${goal.id}`;
    const today = kstDate();
    const lastMonday = addDays(
      today,
      -(((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 7),
    );
    await db.query(
      `INSERT INTO ai_analysis_runs (id, user_id, run_type, period_start, period_end, ingest_key)
       VALUES ($1, $2, 'plan_adjustment', $3::date, $3::date + 6, $4)`,
      [runId, MAIN_ID, lastMonday, ingestKey],
    );
    const res = await http
      .post('/internal/v1/ai-callbacks/plan-adjustments')
      .set('x-internal-token', process.env.INTERNAL_API_TOKEN)
      .send({
        ingestKey,
        runId,
        status: 'completed',
        engineVersion: 'demo-adjust@1',
        reason: '지난주 달성률이 낮아 이번 주 목표를 가볍게 낮춰 봤어요.',
        proposedPlan: [
          {
            stepNo: 1,
            title: '가볍게 다시 시작',
            description: null,
            dueDate: addDays(today, 7),
            missions: [
              {
                scheduledDate: addDays(today, 3),
                title: '스쿼트 10개',
                description: null,
                categoryCode: 'exercise',
                difficultyCode: 'normal',
                exerciseCode: 'squat',
                verificationMethod: 'camera',
                targetValue: 10,
                targetUnit: 'reps',
                estimatedDurationSeconds: 300,
                isRequired: true,
              },
            ],
          },
        ],
      });
    if (res.status !== 200) {
      throw new Error(`재조정 콜백 ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  // ---------- 운동 센서 인증 기준 (빈 규칙이면 새 버전으로 최소값을 둔다: 기준 버전은 수정할 수 없어 v2를 추가) ----------
  {
    const latest = (
      await db.query(
        `SELECT v.rules_json FROM verification_criteria_versions v
           JOIN goal_categories c ON c.id = v.category_id AND c.code = 'exercise'
          WHERE v.verification_method = 'sensor' ORDER BY v.effective_at DESC, v.version_no DESC LIMIT 1`,
      )
    ).rows[0];
    if (latest && Object.keys(latest.rules_json).length === 0) {
      const categoryId = (
        await db.query(`SELECT id FROM goal_categories WHERE code = 'exercise'`)
      ).rows[0].id;
      await adminApi.post(
        '/admin/v1/verification-criteria',
        {
          categoryId,
          verificationMethod: 'sensor',
          rules: { minDurationSeconds: 300, minDistanceMeters: 300 },
          reason: '시연: 러닝 최소 5분·300m',
        },
        201,
      );
      log('운동 센서 인증 기준: 최소 5분·300m 버전 추가');
    } else {
      skip('운동 센서 인증 기준: 이미 값이 있어 건너뜀');
    }
  }

  // ---------- 챌린지: 사용자 제작 검수 ----------
  const lookup = async (table, code) =>
    (await db.query(`SELECT id FROM ${table} WHERE code = $1`, [code])).rows[0]
      .id;
  const challengeDefinition = (title, startDate) => ({
    title,
    description: '시연용 챌린지예요.',
    verificationMethod: 'sensor',
    exerciseCode: 'running',
    startDate,
    endDate: addDays(startDate, 6),
    requiredSuccessDays: 2,
  });

  await step(
    '챌린지 제작 검수',
    ['challenge_publication_reviews'],
    async () => {
      const creatorId = await ensureUser({
        phone: '+821011110003',
        nickname: '챌린지제작시연',
      });
      const creator = asUser(await issueToken('user', creatorId));
      const categoryId = await lookup('goal_categories', 'exercise');
      const difficultyId = await lookup('difficulty_levels', 'normal');
      const start = addDays(kstDate(), 10);
      for (const [title, decision, reason] of [
        ['함께 걷는 주간 챌린지', 'approved', '공개해도 좋은 챌린지예요.'],
        [
          '검수 반려 시연 챌린지',
          'rejected',
          '목표가 구체적이지 않아 반려해요.',
        ],
      ]) {
        const made = await creator.post(
          '/api/v1/challenges',
          { ...challengeDefinition(title, start), categoryId, difficultyId },
          201,
        );
        await creator.post(`/api/v1/challenges/${made.id}/submit`, {}, 200);
        await adminApi.post(
          `/admin/v1/challenges/${made.id}/reviews`,
          { decision, reason },
          200,
        );
      }
    },
  );

  // ---------- 챌린지: 진행 → 종료 → 정산 → 지급(일부 실패) ----------
  await step(
    '챌린지 진행·정산·지급',
    [
      'challenge_moderation_actions',
      'challenge_settlement_runs',
      'challenge_settlement_entries',
      'challenge_final_rankings',
      'challenge_reward_grants',
      'challenge_reward_payment_attempts',
    ],
    async () => {
      const { ScoringService } =
        await import('../dist/challenges/scoring.service.js');
      const { PointsService } =
        await import('../dist/points/points.service.js');
      const categoryId = await lookup('goal_categories', 'exercise');
      const difficultyId = await lookup('difficulty_levels', 'normal');
      const today = () => kstDate();

      // 공식 챌린지: 시작 2일 뒤, 7일, 2일 성공이면 완주
      const startDate = addDays(today(), 2);
      const challenge = await adminApi.post(
        '/admin/v1/challenges',
        {
          ...challengeDefinition('시연 정산 챌린지', startDate),
          categoryId,
          difficultyId,
          reward: { points: 300, userXp: 30, petXp: 60 },
          reason: '시연 정산용 공식 챌린지',
        },
        201,
      );
      await adminApi.patch(
        `/admin/v1/challenges/${challenge.id}`,
        { action: 'publish', reason: '시연 공개' },
        200,
      );

      const names = [
        '정산시연A',
        '정산시연B',
        '정산시연C',
        '정산시연D',
        '정산시연E',
      ];
      const users = [];
      for (const [index, nickname] of names.entries()) {
        const id = await ensureUser({
          phone: `+82101111010${index}`,
          nickname,
        });
        users.push({ id, token: await issueToken('user', id) });
      }
      const [a, b, c, d, e] = users;
      for (const u of users) {
        await call(
          'post',
          `/api/v1/challenges/${challenge.id}/participations`,
          u.token,
          {},
          { expect: 201 },
        );
      }

      // 날짜 되감기 (e2e와 같은 방식): 챌린지 날짜를 앞으로 당겨 "오늘"을 챌린지 안으로 옮긴다
      const shiftBy = async (days) => {
        if (days === 0) return;
        const ids = `SELECT mission_id FROM challenge_daily_missions WHERE challenge_id = $1`;
        await bypass(
          `UPDATE challenges SET start_date = start_date - $2::int, end_date = end_date - $2::int WHERE id = $1`,
          [challenge.id, days],
        );
        await bypass(
          `UPDATE missions SET scheduled_date = scheduled_date - $2::int WHERE id IN (${ids})`,
          [challenge.id, days],
        );
        await bypass(
          `UPDATE challenge_daily_missions SET challenge_date = challenge_date + 1000 WHERE challenge_id = $1`,
          [challenge.id],
        );
        await bypass(
          `UPDATE challenge_daily_missions SET challenge_date = challenge_date - 1000 - $2::int WHERE challenge_id = $1`,
          [challenge.id, days],
        );
        await bypass(
          `UPDATE mission_records SET started_at = started_at - make_interval(days => $2),
                  submitted_at = submitted_at - make_interval(days => $2),
                  completed_at = completed_at - make_interval(days => $2)
            WHERE mission_id IN (${ids})`,
          [challenge.id, days],
        );
        await bypass(
          `UPDATE verification_results SET decided_at = decided_at - make_interval(days => $2),
                  notified_at = notified_at - make_interval(days => $2)
            WHERE record_id IN (SELECT id FROM mission_records WHERE mission_id IN (${ids}))`,
          [challenge.id, days],
        );
      };
      const goToDay = async (dayIndex) => {
        const { d } = (
          await db.query(
            'SELECT start_date::text AS d FROM challenges WHERE id = $1',
            [challenge.id],
          )
        ).rows[0];
        const diff = Math.round(
          (Date.parse(`${addDays(d, dayIndex)}T00:00:00Z`) -
            Date.parse(`${today()}T00:00:00Z`)) /
            86_400_000,
        );
        await shiftBy(diff);
      };
      const perform = async (u, dayIndex) => {
        await goToDay(dayIndex);
        const { mission_id: missionId } = (
          await db.query(
            `SELECT mission_id FROM challenge_daily_missions WHERE user_id = $1 AND challenge_id = $2
              ORDER BY challenge_date OFFSET $3 LIMIT 1`,
            [u.id, challenge.id, dayIndex],
          )
        ).rows[0];
        const record = await call(
          'post',
          `/api/v1/missions/${missionId}/records`,
          u.token,
          {},
          { expect: 201 },
        );
        await call(
          'post',
          `/api/v1/records/${record.id}/submit`,
          u.token,
          { metrics: { steps: 1 } },
          { expect: 200 },
        );
        const res = await http
          .post('/internal/v1/ai-callbacks/verification-results')
          .set('x-internal-token', process.env.INTERNAL_API_TOKEN)
          .send({
            ingestKey: randomUUID(),
            recordId: record.id,
            decision: 'approved',
            engineVersion: 'demo-model@1',
            confidence: 0.9,
            metrics: { score: 0.5 },
            reason: '시연 판정',
            rawResult: { demo: true },
          });
        if (res.status !== 200)
          throw new Error(
            `판정 콜백 ${res.status}: ${JSON.stringify(res.body)}`,
          );
      };
      const participationOf = async (u) =>
        (
          await db.query(
            'SELECT id FROM challenge_participations WHERE user_id = $1 AND challenge_id = $2',
            [u.id, challenge.id],
          )
        ).rows[0].id;

      // A 3일 성공, B 2일(완주), C 1일(미달), D 중도 포기, E 실격
      await perform(a, 0);
      await perform(b, 0);
      await perform(c, 0);
      await perform(e, 0);
      await goToDay(1);
      await perform(a, 1);
      await perform(b, 1);
      await http
        .delete(`/api/v1/challenges/${challenge.id}/participations/me`)
        .set('Authorization', `Bearer ${d.token}`)
        .set('Idempotency-Key', randomUUID())
        .expect(204);
      await adminApi.post(
        `/admin/v1/challenges/${challenge.id}/moderation-actions`,
        {
          participationId: await participationOf(e),
          action: 'disqualify',
          reason: '시연: 부정 행위 의심',
        },
        200,
      );
      await perform(a, 2);

      // 종료 다음 날로 이동해 일별 결과를 확정하고 정산 초안 → 확정
      await goToDay(7);
      await app.get(ScoringService).settleDays();
      const run = await adminApi.post(
        `/admin/v1/challenges/${challenge.id}/settlement-runs`,
        { reason: '시연 정산 초안' },
        201,
      );
      // 첫 지급 한 건을 일부러 실패시킨다 (관리자 웹의 "지급 실패 → 재시도" 화면용). 재시도는 하지 않고 남겨 둔다
      const points = app.get(PointsService);
      const original = points.awardAutoPoints.bind(points);
      let calls = 0;
      points.awardAutoPoints = async (...args) => {
        calls += 1;
        if (calls === 1) throw new Error('시연: 포인트 서비스 일시 장애');
        return original(...args);
      };
      try {
        await adminApi.post(
          `/admin/v1/settlement-runs/${run.id}/confirm`,
          { reason: '시연 정산 확정' },
          200,
        );
      } finally {
        points.awardAutoPoints = original;
      }
    },
  );

  // ---------- 연속 기록 마일스톤 · 포인트 회수 청구 · 펫 진화 ----------
  // 공통: 미션을 만들고(보상 지정) 기록 제출 → AI 판정 승인까지 앱 경로로 처리한 뒤 N일 전의 일로 되감는다
  const rate = (
    await db.query(
      `SELECT r.id, r.points, r.user_xp, r.pet_xp FROM mission_reward_rate_versions r
         JOIN goal_categories c ON c.id = r.category_id AND c.code = 'exercise'
         JOIN difficulty_levels d ON d.id = r.difficulty_id AND d.code = 'normal'
        ORDER BY r.effective_at DESC LIMIT 1`,
    )
  ).rows[0];
  const rateId = rate.id;
  // 미션 보상은 시행 중인 금액 기준표와 같아야 해서(트리거 검사) 기준표 값을 그대로 쓴다
  async function resolvedMission(
    u,
    { offset = 0, decision = 'approved' } = {},
  ) {
    const [points, userXp, petXp] = [rate.points, rate.user_xp, rate.pet_xp];
    const missionId = randomUUID();
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, verification_method,
               scheduled_date, reward_points, reward_rate_version_id, reward_user_xp, reward_pet_xp)
       VALUES ($1,$2,'user','시연 미션',
               (SELECT id FROM goal_categories WHERE code = 'exercise'),
               (SELECT id FROM difficulty_levels WHERE code = 'normal'),
               'sensor',$3,$4,$5,$6,$7)`,
      [missionId, u.id, kstDate(), points, rateId, userXp, petXp],
    );
    const record = await call(
      'post',
      `/api/v1/missions/${missionId}/records`,
      u.token,
      {},
      { expect: 201 },
    );
    await call(
      'post',
      `/api/v1/records/${record.id}/submit`,
      u.token,
      { metrics: { steps: 8000 } },
      { expect: 200 },
    );
    const res = await http
      .post('/internal/v1/ai-callbacks/verification-results')
      .set('x-internal-token', process.env.INTERNAL_API_TOKEN)
      .send({
        ingestKey: randomUUID(),
        recordId: record.id,
        decision,
        engineVersion: 'demo-model@1',
        confidence: 0.9,
        metrics: { score: 0.5 },
        reason: '시연 판정',
        rawResult: { demo: true },
      });
    if (res.status !== 200)
      throw new Error(`판정 콜백 ${res.status}: ${JSON.stringify(res.body)}`);
    if (offset > 0) {
      await bypass(
        `UPDATE missions SET scheduled_date = scheduled_date - $2::int, due_at = due_at - make_interval(days => $2),
                created_at = created_at - make_interval(days => $2), updated_at = updated_at - make_interval(days => $2)
          WHERE id = $1`,
        [missionId, offset],
      );
      await bypass(
        `UPDATE mission_records SET started_at = started_at - make_interval(days => $2),
                submitted_at = submitted_at - make_interval(days => $2),
                completed_at = completed_at - make_interval(days => $2)
          WHERE mission_id = $1`,
        [missionId, offset],
      );
      await bypass(
        `UPDATE verification_results SET decided_at = decided_at - make_interval(days => $2),
                notified_at = notified_at - make_interval(days => $2)
          WHERE record_id IN (SELECT id FROM mission_records WHERE mission_id = $1)`,
        [missionId, offset],
      );
    }
    return { missionId, recordId: record.id };
  }
  const demoUser = async (phone, nickname) => {
    const id = await ensureUser({ phone, nickname });
    return { id, token: await issueToken('user', id) };
  };

  await step(
    '연속 기록 7일 마일스톤',
    ['streak_milestone_awards'],
    async () => {
      const u = await demoUser('+821011110004', '연속기록시연');
      for (const offset of [6, 5, 4, 3, 2, 1, 0]) {
        await resolvedMission(u, { offset });
      }
    },
  );

  await step('포인트 회수 청구', ['point_recovery_claims'], async () => {
    const u = await demoUser('+821011110005', '포인트회수시연');
    const { recordId } = await resolvedMission(u);
    // 일부를 먼저 회수(관리자 조정)해 잔액을 줄여 두면, 이후 승인 취소 때 부족분이 "미회수 청구"로 남는다
    await adminApi.post(
      '/admin/v1/point-adjustments',
      {
        userId: u.id,
        kind: 'manual_recovery',
        amount: 14,
        reason: '시연: 잔액 일부 회수',
      },
      201,
    );
    const { DecisionService } =
      await import('../dist/verification/decision.service.js');
    await db.withTransaction((tx) =>
      app.get(DecisionService).applyDecision(tx, {
        recordId,
        source: 'admin',
        decision: 'rejected',
        reason: '시연: 재판정으로 승인 취소',
        adminId: ADMIN_ID,
      }),
    );
  });

  await step('펫 진화', ['pet_evolution_events'], async () => {
    const u = await demoUser('+821011110006', '펫진화시연');
    const speciesId = (
      await db.query(`SELECT id FROM pet_species WHERE code = 'steady_cat'`)
    ).rows[0].id;
    // 앞선 시도에서 이미 입양했으면(409) 그대로 이어간다
    const adopted = await http
      .post('/api/v1/me/pets')
      .set('Authorization', `Bearer ${u.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ speciesId, nickname: '시연냥', makeRepresentative: true });
    if (![201, 409].includes(adopted.status)) {
      throw new Error(
        `펫 입양 ${adopted.status}: ${JSON.stringify(adopted.body)}`,
      );
    }
    // 알 → 아기 단계 기준(펫 경험치 50)을 넘기도록 미션 5건(미션당 10)을 승인받는다
    for (let i = 0; i < 5; i += 1) await resolvedMission(u);
  });
} catch (error) {
  console.error(`\n시연 데이터 채우기 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  console.log('\n──────── 요약 ────────');
  const emptyNow = (
    await db.query(
      `SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS n
         FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    )
  ).rows.filter((row) => row.n === 0);
  for (const r of results) {
    console.log(`  [${r.state}] ${r.name}${r.error ? ` — ${r.error}` : ''}`);
  }
  // 시연에 필요 없는 표(로그인 대기·기기 토큰은 덤프에서도 비움)는 빼고 보여 준다
  const EXCLUDED = new Set([
    'phone_verification_challenges',
    'push_devices',
    'schema_migrations',
    'auth_sessions',
    'admin_sessions',
    'admin_idempotency_keys',
    'user_idempotency_keys',
  ]);
  const left = emptyNow.filter((row) => !EXCLUDED.has(row.table_name));
  console.log(`\n아직 비어 있는 표: ${left.length}개`);
  if (left.length)
    console.log(`  ${left.map((row) => row.table_name).join(', ')}`);
  if (left.some((row) => row.table_name === 'challenge_score_snapshots')) {
    console.log(
      '  ※ challenge_score_snapshots 는 현재 앱 코드가 쓰지 않는 표라 앱 경로로는 채울 수 없어요(순위는 뷰·최종 순위 표로 계산).',
    );
  }
  await app.close();
}
