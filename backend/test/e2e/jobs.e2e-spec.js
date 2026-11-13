import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { JobLock } from '../../src/jobs/job-lock.service.js';
import { JobsService } from '../../src/jobs/jobs.service.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';
import { AiDispatchService } from '../../src/verification/ai/ai-dispatch.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const MB = 1024 * 1024;
const SECRET = 'test-ai-ingest-secret-0123456789-abcdef';

describe.skipIf(!databaseUrl)('정기 작업 (PostgreSQL + 메모리 저장소)', () => {
  let app;
  let db;
  let http;
  let storage;
  let jobs;
  let adminId;
  let categoryId;
  let difficultyId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  /** 트리거가 막는 시각·상태 조작을 테스트에서만 우회 */
  const bypass = (sql, params) =>
    tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(sql, params);
    });

  const createUser = () => createUserWith(app, db);

  async function createMission(
    user,
    { status = 'scheduled', date = kstDate(), dueAt, method = 'sensor' } = {},
  ) {
    const id = newId();
    await bypass(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, verification_method,
               scheduled_date, status, due_at)
       VALUES ($1,$2,'user','작업 미션',$3,$4,$8,$5,$6,$7)`,
      [
        id,
        user.id,
        categoryId,
        difficultyId,
        date,
        status,
        dueAt ?? null,
        method,
      ],
    );
    return id;
  }

  const missionStatus = async (id) =>
    (await db.query('SELECT status FROM missions WHERE id = $1', [id])).rows[0]
      .status;
  const PAST = "now() - interval '1 hour'";

  async function startRecord(user, missionId) {
    return (
      await http
        .post(`/api/v1/missions/${missionId}/records`)
        .set(auth(user.token))
        .expect(201)
    ).body;
  }
  async function submit(user, recordId) {
    await http
      .post(`/api/v1/records/${recordId}/submit`)
      .set(auth(user.token))
      .send({ metrics: { steps: 1 } })
      .expect(200);
  }
  const mediaStatus = async (id) =>
    (
      await db.query('SELECT upload_status FROM media_files WHERE id = $1', [
        id,
      ])
    ).rows[0].upload_status;

  async function registerPhoto(user, recordId) {
    const res = await http
      .post(`/api/v1/records/${recordId}/media`)
      .set(auth(user.token))
      .send({
        mediaKind: 'camera_photo',
        mimeType: 'image/jpeg',
        sizeBytes: MB,
      })
      .expect(201);
    const { rows } = await db.query(
      'SELECT object_key FROM media_files WHERE id = $1',
      [res.body.id],
    );
    return { id: res.body.id, key: rows[0].object_key };
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    storage = app.get(OBJECT_STORAGE);
    jobs = app.get(JobsService);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `jb_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    categoryId = newId();
    difficultyId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `jbc${RUN}`, `작업카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `jbd${RUN}`, `작업난이도${RUN}`],
    );
    for (const method of ['sensor', 'camera']) {
      await db.query(
        `INSERT INTO verification_criteria_versions
                (id, category_id, verification_method, version_no, rules_json, effective_at,
                 created_by_admin_id)
         VALUES ($1,$2,$3,1,'{"minSteps":1}'::jsonb, now() - interval '30 days', $4)`,
        [newId(), categoryId, method, adminId],
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('실행기', () => {
    it('작업 목록, 알 수 없는 작업은 오류, 겹쳐 실행하지 않고 오류는 삼킴', async () => {
      expect(jobs.names()).toEqual(
        expect.arrayContaining([
          'ai-dispatch',
          'media-reconcile-pending',
          'media-finish-deletions',
          'media-purge-withdrawn',
          'missions-fail-overdue',
          'proposals-expire',
          'idempotency-cleanup',
        ]),
      );
      await expect(jobs.runJob('nope')).rejects.toThrow(RangeError);

      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      jobs.jobs.push({ name: 'test-slow', everyMs: 1000, run: () => gate });
      jobs.jobs.push({
        name: 'test-broken',
        everyMs: 1000,
        run: async () => {
          throw new Error('boom');
        },
      });
      try {
        const first = jobs.runJob('test-slow');
        expect(await jobs.runJob('test-slow')).toEqual({ skipped: 'running' });
        release({ done: 1 });
        expect(await first).toEqual({ done: 1 });
        expect(await jobs.runJob('test-broken')).toEqual({ error: 'boom' });
        expect(jobs.running.size).toBe(0);
      } finally {
        jobs.jobs.splice(jobs.jobs.length - 2, 2);
      }
    });

    it('멱등 키 정리: 보관 기간이 지난 앱·관리자 키만 삭제', async () => {
      const user = await createUser();
      const tag = newId();
      const insert = (table, ownerColumn, ownerId, key, age) =>
        db.query(
          `INSERT INTO ${table} (id, ${ownerColumn}, idempotency_key, operation, request_hash, created_at)
           VALUES ($1, $2, $3, 'test.op', 'hash', now() - $4::interval)`,
          [newId(), ownerId, key, age],
        );
      await insert(
        'user_idempotency_keys',
        'user_id',
        user.id,
        `old-${tag}`,
        '3 days',
      );
      await insert(
        'user_idempotency_keys',
        'user_id',
        user.id,
        `new-${tag}`,
        '1 hour',
      );
      await insert(
        'admin_idempotency_keys',
        'admin_id',
        adminId,
        `old-${tag}`,
        '3 days',
      );
      await insert(
        'admin_idempotency_keys',
        'admin_id',
        adminId,
        `new-${tag}`,
        '1 hour',
      );

      const result = await jobs.runJob('idempotency-cleanup');
      expect(result.user).toBeGreaterThanOrEqual(1);
      expect(result.admin).toBeGreaterThanOrEqual(1);

      const left = await db.query(
        `SELECT idempotency_key FROM user_idempotency_keys WHERE idempotency_key LIKE $1
         UNION ALL
         SELECT idempotency_key FROM admin_idempotency_keys WHERE idempotency_key LIKE $1`,
        [`%-${tag}`],
      );
      expect(left.rows.map((row) => row.idempotency_key)).toEqual([
        `new-${tag}`,
        `new-${tag}`,
      ]);
    });

    it('JobLock: 다른 인스턴스가 같은 작업을 잡고 있으면 건너뜀', async () => {
      const lock = app.get(JobLock);
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const first = lock.runExclusive('lock-test', () => gate);
      // 첫 락 획득이 끝날 때까지 잠시 양보
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(await lock.runExclusive('lock-test', async () => 1)).toEqual({
        skipped: 'locked',
      });
      expect(await lock.runExclusive('lock-other', async () => 2)).toBe(2);
      release('done');
      expect(await first).toBe('done');
      expect(await lock.runExclusive('lock-test', async () => 3)).toBe(3);
    });

    it('개발용 수동 실행: X-Internal-Token 필요, 없는 작업은 404', async () => {
      const url = '/internal/v1/dev/jobs/proposals-expire';
      await http.post(url).expect(401);
      await http.post(url).set('X-Internal-Token', 'x'.repeat(40)).expect(401);
      const ok = await http
        .post(url)
        .set('X-Internal-Token', SECRET)
        .expect(200);
      expect(ok.body).toEqual({ job: 'proposals-expire', ok: true });
      const missing = await http
        .post('/internal/v1/dev/jobs/nope')
        .set('X-Internal-Token', SECRET)
        .expect(404);
      expect(missing.body.error.code).toBe('COMMON_NOT_FOUND');
    });

    it('JOBS_DISABLED가 꺼졌을 때만 타이머를 만들고 종료 시 정리', () => {
      const config = app.get(ConfigService);
      const original = config.get.bind(config);
      expect(jobs.timers).toHaveLength(0); // 테스트 환경은 JOBS_DISABLED=true
      config.get = (key, ...rest) =>
        key === 'JOBS_DISABLED' ? false : original(key, ...rest);
      try {
        jobs.onApplicationBootstrap();
        expect(jobs.timers.length).toBe(jobs.jobs.length);
      } finally {
        config.get = original;
        jobs.onModuleDestroy();
      }
      expect(jobs.timers).toHaveLength(0);
    });
  });

  describe('미션 마감 처리', () => {
    it('마감이 지났고 판정 대기 제출이 없는 scheduled/in_progress 미션만 failed로', async () => {
      const user = await createUser();
      const overdue = await createMission(user, {
        dueAt: new Date(Date.now() - 3_600_000),
      });
      const overdueInProgress = await createMission(user, {
        status: 'in_progress',
        dueAt: new Date(Date.now() - 3_600_000),
      });
      // 시작만 하고 제출하지 못한 채 마감
      const unfinished = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
      });
      const record = await startRecord(user, unfinished);
      await bypass(`UPDATE missions SET due_at = ${PAST} WHERE id = $1`, [
        unfinished,
      ]);
      // due_at 없이 예정일이 이틀 전
      const noDueAt = await createMission(user, {
        date: addDays(kstDate(), -2),
      });

      const future = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
      });
      const todayNoDueAt = await createMission(user);
      const completed = await createMission(user, {
        status: 'completed',
        dueAt: new Date(Date.now() - 3_600_000),
      });

      // 제출이 판정을 기다리는 중이면 건드리지 않음
      const waiting = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
      });
      const waitingRecord = await startRecord(user, waiting);
      await submit(user, waitingRecord.id);
      await bypass(`UPDATE missions SET due_at = ${PAST} WHERE id = $1`, [
        waiting,
      ]);

      // 다른 스위트가 남긴 마감 지난 미션이 많으면 한 번에 처리 상한(200)에 걸리므로 다 처리될 때까지 반복
      let failedTotal = 0;
      for (let i = 0; i < 50; i++) {
        const { failed } = await jobs.runJob('missions-fail-overdue');
        failedTotal += failed;
        if (failed === 0) break;
      }
      expect(failedTotal).toBeGreaterThanOrEqual(4);
      for (const id of [overdue, overdueInProgress, unfinished, noDueAt]) {
        expect(await missionStatus(id)).toBe('failed');
      }
      for (const [id, status] of [
        [future, 'scheduled'],
        [todayNoDueAt, 'scheduled'],
        [completed, 'completed'],
        [waiting, 'submitted'],
      ]) {
        expect(await missionStatus(id)).toBe(status);
      }

      // 마감 뒤에는 제출할 수 없고 다시 실행해도 변화 없음
      await http
        .post(`/api/v1/records/${record.id}/submit`)
        .set(auth(user.token))
        .send({ metrics: { steps: 1 } })
        .expect((res) => {
          if (res.status < 400) throw new Error(`제출이 허용됨 ${res.status}`);
        });
      expect((await jobs.runJob('missions-fail-overdue')).failed).toBe(0);
    });
  });

  describe('파일 정리', () => {
    it('만료된 pending은 failed로 정리하고 객체를 지움, 맞게 올라온 건 uploaded로 확정', async () => {
      const user = await createUser();
      const missionId = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
        method: 'camera',
      });
      const record = await startRecord(user, missionId);
      // 카메라 증거는 회차당 1개라 파일마다 다른 회차를 쓴다
      const second = await startRecord(
        user,
        await createMission(user, {
          dueAt: new Date(Date.now() + 3_600_000),
          method: 'camera',
        }),
      );
      const abandoned = await registerPhoto(user, record.id);
      const landed = await registerPhoto(user, second.id);
      storage.simulateUpload(landed.key, {
        size: MB,
        contentType: 'image/jpeg',
      });
      storage.simulateUpload(abandoned.key, {
        size: 10,
        contentType: 'image/jpeg',
      }); // 신고와 다른 크기
      await bypass(
        `UPDATE media_files SET created_at = now() - interval '2 hours', upload_url_expires_at = ${PAST} WHERE id = ANY($1)`,
        [[abandoned.id, landed.id]],
      );

      const result = await jobs.runJob('media-reconcile-pending');
      expect(result.uploaded).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(await mediaStatus(landed.id)).toBe('uploaded');
      expect(await mediaStatus(abandoned.id)).toBe('failed');
      expect(await storage.head(abandoned.key)).toBeNull();
    });

    it('탈퇴 처리 중인 사용자의 파일은 R2에서 지우고 deleted로, 다른 사용자는 건드리지 않음', async () => {
      const leaving = await createUser();
      const staying = await createUser();
      const files = {};
      for (const [name, user] of [
        ['leaving', leaving],
        ['staying', staying],
      ]) {
        const missionId = await createMission(user, {
          dueAt: new Date(Date.now() + 3_600_000),
          method: 'camera',
        });
        const record = await startRecord(user, missionId);
        const photo = await registerPhoto(user, record.id);
        storage.simulateUpload(photo.key, {
          size: MB,
          contentType: 'image/jpeg',
        });
        await http
          .post(`/api/v1/media/${photo.id}/complete`)
          .set(auth(user.token))
          .expect(200);
        files[name] = photo;
      }
      await db.query(
        `UPDATE users SET status = 'withdrawal_processing' WHERE id = $1`,
        [leaving.id],
      );

      const result = await jobs.runJob('media-purge-withdrawn');
      expect(result.users).toBeGreaterThanOrEqual(1);
      expect(await mediaStatus(files.leaving.id)).toBe('deleted');
      expect(await storage.head(files.leaving.key)).toBeNull();
      expect(await mediaStatus(files.staying.id)).toBe('uploaded');
      expect(await storage.head(files.staying.key)).not.toBeNull();

      // 이미 정리된 사용자는 다음 주기에 대상이 아님
      const again = await db.query(
        `SELECT 1 FROM media_files WHERE user_id = $1 AND upload_status <> 'deleted'`,
        [leaving.id],
      );
      expect(again.rows).toHaveLength(0);
    });
  });

  describe('AI 판정 요청', () => {
    let dispatch;
    let calls;
    let fail;
    let service;

    beforeEach(() => {
      service = app.get(AiDispatchService);
      calls = [];
      fail = false;
      dispatch = service.dispatcher;
      service.dispatcher = {
        enabled: true,
        dispatch: async (request) => {
          calls.push(request);
          if (fail) throw new Error('AI 장애');
        },
      };
      service.attempts.clear();
    });
    afterEach(() => {
      service.dispatcher = dispatch;
    });

    const mine = (recordId) => calls.filter((c) => c.recordId === recordId);

    it('요청 설정이 없으면 아무것도 하지 않음', async () => {
      service.dispatcher = dispatch;
      expect(await jobs.runJob('ai-dispatch')).toEqual({ skipped: true });
    });

    it('제출됐고 판정이 없는 회차만 증거 파일(조회 URL)과 판정 기준을 담아 요청하고, 백오프 전에는 다시 보내지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
        method: 'camera',
      });
      const record = await startRecord(user, missionId);
      const photo = await registerPhoto(user, record.id);
      storage.simulateUpload(photo.key, {
        size: MB,
        contentType: 'image/jpeg',
      });
      await http
        .post(`/api/v1/media/${photo.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      await submit(user, record.id);
      const notSubmitted = await startRecord(user, await createMission(user));

      const now = Date.now();
      await service.dispatchPending({ limit: 1000, now });
      expect(mine(record.id)).toHaveLength(1);
      expect(mine(notSubmitted.id)).toHaveLength(0);
      expect(mine(record.id)[0]).toMatchObject({
        recordId: record.id,
        missionId,
        userId: user.id,
        verificationMethod: 'camera',
        submissionNo: 1,
        criteria: { versionNo: 1, rules: { minSteps: 1 } },
      });
      expect(mine(record.id)[0].files).toEqual([
        expect.objectContaining({
          id: photo.id,
          mediaKind: 'camera_photo',
          mimeType: 'image/jpeg',
        }),
      ]);
      expect(mine(record.id)[0].files[0].url).toContain(photo.key);

      await service.dispatchPending({ limit: 1000, now: now + 10_000 });
      expect(mine(record.id)).toHaveLength(1);
      await service.dispatchPending({ limit: 1000, now: now + 31_000 });
      expect(mine(record.id)).toHaveLength(2);

      // 판정이 나면 더 이상 요청하지 않음
      await http
        .post('/internal/v1/ai-callbacks/verification-results')
        .set('x-internal-token', SECRET)
        .send({
          ingestKey: newId(),
          recordId: record.id,
          decision: 'review_required',
          engineVersion: 'model-v1',
          rawResult: {},
        })
        .expect(200);
      await service.dispatchPending({ limit: 1000, now: now + 3_600_000 });
      expect(mine(record.id)).toHaveLength(2);
      expect(service.attempts.has(record.id)).toBe(false);
    });

    it('요청이 실패하면 지수 백오프로 재시도하고 횟수를 넘으면 포기', async () => {
      const user = await createUser();
      const missionId = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
      });
      const record = await startRecord(user, missionId);
      await submit(user, record.id);
      fail = true;

      let now = Date.now();
      const first = await service.dispatchPending({ limit: 1000, now });
      expect(first.failed).toBeGreaterThanOrEqual(1);
      expect(mine(record.id)).toHaveLength(1);

      // 30초 뒤, 그다음 60초 뒤 … 간격이 두 배씩
      await service.dispatchPending({ limit: 1000, now: now + 29_000 });
      expect(mine(record.id)).toHaveLength(1);
      now += 31_000;
      await service.dispatchPending({ limit: 1000, now });
      expect(mine(record.id)).toHaveLength(2);
      await service.dispatchPending({ limit: 1000, now: now + 59_000 });
      expect(mine(record.id)).toHaveLength(2);

      let gaveUp = 0;
      for (let i = 0; i < 10; i++) {
        now += 2 * 3_600_000;
        gaveUp += (await service.dispatchPending({ limit: 1000, now })).gaveUp;
      }
      expect(mine(record.id)).toHaveLength(8);
      expect(gaveUp).toBeGreaterThanOrEqual(1);

      // 포기하면 판정 없이 관리자 검수로 넘어가고 더 이상 요청하지 않음
      const { rows } = await db.query(
        'SELECT status FROM mission_records WHERE id = $1',
        [record.id],
      );
      expect(rows[0].status).toBe('review_required');
      const { rows: results } = await db.query(
        'SELECT 1 FROM verification_results WHERE record_id = $1',
        [record.id],
      );
      expect(results).toHaveLength(0);
      await service.dispatchPending({ limit: 1000, now: now + 3_600_000 });
      expect(mine(record.id)).toHaveLength(8);
      expect(service.attempts.has(record.id)).toBe(false);
    }, 120_000);

    it('보냈는데 결과가 끝내 오지 않아도 정해진 횟수 뒤 관리자 검수로 넘김', async () => {
      const user = await createUser();
      const missionId = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000),
      });
      const record = await startRecord(user, missionId);
      await submit(user, record.id);

      let now = Date.now();
      for (let i = 0; i < 10; i++) {
        await service.dispatchPending({ limit: 1000, now });
        now += 2 * 3_600_000;
      }
      expect(mine(record.id)).toHaveLength(8);
      const { rows } = await db.query(
        'SELECT status FROM mission_records WHERE id = $1',
        [record.id],
      );
      expect(rows[0].status).toBe('review_required');
    }, 120_000);
  });

  describe('AI 제안 만료', () => {
    it('작업이 실행됨', async () => {
      const result = await jobs.runJob('proposals-expire');
      expect(result).toHaveProperty('expired');
    });
  });
});
