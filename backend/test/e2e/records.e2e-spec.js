import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate, kstDayStart } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게
const MB = 1024 * 1024;

describe.skipIf(!databaseUrl)('수행 회차 (PostgreSQL + 메모리 저장소)', () => {
  let app;
  let db;
  let http;
  let storage;
  let adminId;
  let categoryId;
  let difficultyId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const day = (offset) => addDays(kstDate(), offset);

  const createUser = () => createUserWith(app, db);

  async function createMission(
    user,
    {
      method = 'sensor',
      date = kstDate(),
      dueAt = null,
      status = 'scheduled',
    } = {},
  ) {
    const id = newId();
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date, due_at, status,
               cancel_reason, cancelled_at)
       VALUES ($1,$2,'user','인증 미션',$3,$4,$5,$6,$7,$8,
               CASE WHEN $9::text = 'cancelled' THEN 'user_cancelled' END,
               CASE WHEN $9::text = 'cancelled' THEN now() END)`,
      [
        id,
        user.id,
        categoryId,
        difficultyId,
        method,
        date,
        dueAt,
        status,
        status,
      ],
    );
    return id;
  }

  const start = (user, missionId) =>
    http.post(`/api/v1/missions/${missionId}/records`).set(auth(user.token));
  const submit = (user, recordId, body = {}) =>
    http
      .post(`/api/v1/records/${recordId}/submit`)
      .set(auth(user.token))
      .send(body);

  async function startedRecord(user, missionId) {
    return (await start(user, missionId)).body;
  }

  /** 사진 한 장을 등록·업로드·확인까지 */
  async function attachPhoto(user, recordId) {
    const registered = await http
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
      [registered.body.id],
    );
    storage.simulateUpload(rows[0].object_key, {
      size: MB,
      contentType: 'image/jpeg',
    });
    await http
      .post(`/api/v1/media/${registered.body.id}/complete`)
      .set(auth(user.token))
      .expect(200);
    return { id: registered.body.id, key: rows[0].object_key };
  }

  const missionStatus = async (id) =>
    (await db.query('SELECT status FROM missions WHERE id = $1', [id])).rows[0]
      .status;

  /** 판정 행을 판정 반영 경로를 거치지 않고 직접 넣음 */
  async function insertResult(
    recordId,
    { decision, ageDays = 0, notified = true, reason = null },
  ) {
    const criteria = await ensureCriteria();
    const id = newId();
    await db.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision, criteria_version_id, engine_version,
               reason, decided_at, notified_at)
       VALUES ($1,$2,1,'ai',$3,$4,'model-v1',$5,
               now() - make_interval(days => $6),
               CASE WHEN $7 THEN now() - make_interval(days => $6) END)`,
      [id, recordId, decision, criteria, reason, ageDays, notified],
    );
    return id;
  }

  let criteriaId = null;
  async function ensureCriteria() {
    if (criteriaId) return criteriaId;
    criteriaId = newId();
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{}'::jsonb, now() - interval '30 days', $3)`,
      [criteriaId, categoryId, adminId],
    );
    return criteriaId;
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    storage = app.get(OBJECT_STORAGE);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `rc_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    categoryId = newId();
    difficultyId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `rcc${RUN}`, `회차카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `rcd${RUN}`, `회차난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('시작', () => {
    it('회차를 만들고 미션을 진행 중으로 바꾸며 번호는 1부터', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const res = await start(user, missionId).expect(201);

      expect(res.body).toMatchObject({
        missionId,
        attemptNo: 1,
        submissionNo: null,
        status: 'recording',
        evidenceKind: null,
        submittedAt: null,
        files: [],
        result: null,
        appeal: null,
      });
      expect(await missionStatus(missionId)).toBe('in_progress');
      // 대표 펫이 없으면 고정값도 없음 (DB 트리거가 시작 시점에 채움)
      const { rows } = await db.query(
        'SELECT reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points FROM mission_records WHERE id = $1',
        [res.body.id],
      );
      expect(rows[0]).toEqual({
        reward_pet_id: null,
        reward_pet_stage_no: null,
        reward_pet_bonus_basis_points: 0,
      });
    });

    it('열려 있는 회차가 있으면 새로 만들지 않고 같은 회차를 200으로 돌려줌, 동시 요청에도 하나', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const first = (await start(user, missionId).expect(201)).body;
      const again = await start(user, missionId).expect(200);
      expect(again.body.id).toBe(first.id);

      await db.query(
        `UPDATE mission_records SET status = 'uploading' WHERE id = $1`,
        [first.id],
      );
      expect((await start(user, missionId).expect(200)).body.id).toBe(first.id);

      const fresh = await createMission(user);
      const results = await Promise.all(
        [1, 2, 3, 4].map(() => start(user, fresh)),
      );
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      const { rows } = await db.query(
        'SELECT 1 FROM mission_records WHERE mission_id = $1',
        [fresh],
      );
      expect(rows).toHaveLength(1);
    });

    it('시작 가능 시간은 예정일 00:00(KST)부터 마감까지', async () => {
      const user = await createUser();
      const future = await createMission(user, { date: day(1) });
      const notStarted = await start(user, future).expect(409);
      expect(notStarted.body.error).toMatchObject({
        code: 'MISSION_NOT_STARTED',
        details: { startsAt: kstDayStart(day(1)).toISOString() },
      });

      const pastDue = await createMission(user, {
        date: day(-1),
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect((await start(user, pastDue).expect(409)).body.error.code).toBe(
        'MISSION_EXPIRED',
      );
      // due_at이 없으면 예정일 다음 날 00:00이 마감
      const yesterday = await createMission(user, { date: day(-1) });
      expect((await start(user, yesterday).expect(409)).body.error.code).toBe(
        'MISSION_EXPIRED',
      );
      await start(
        user,
        await createMission(user, {
          dueAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      ).expect(201);
    });

    it('끝났거나 취소된 미션은 시작할 수 없고, 남의 미션·없는 미션은 404', async () => {
      const user = await createUser();
      const other = await createUser();
      for (const status of ['completed', 'failed', 'cancelled']) {
        const id = await createMission(user, { status });
        const res = await start(user, id).expect(409);
        expect(res.body.error).toMatchObject({
          code: 'MISSION_NOT_STARTABLE',
          details: { status },
        });
      }
      const mine = await createMission(user);
      await start(other, mine).expect(404);
      await start(user, newId()).expect(404);
      await db.query('UPDATE missions SET deleted_at = now() WHERE id = $1', [
        mine,
      ]);
      await start(user, mine).expect(404);
      await http
        .post('/api/v1/missions/not-a-uuid/records')
        .set(auth(user.token))
        .expect(400);
      await http.post(`/api/v1/missions/${mine}/records`).expect(401);
    });

    it('판정 대기 중인 미션(submitted)에서도 남은 횟수 안에서 새 회차를 시작할 수 있음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const record = await startedRecord(user, missionId);
      await submit(user, record.id, { metrics: { steps: 100 } }).expect(200);
      expect(await missionStatus(missionId)).toBe('submitted');

      const second = await start(user, missionId).expect(201);
      expect(second.body.attemptNo).toBe(2);
      expect(await missionStatus(missionId)).toBe('submitted');
    });

    it('제출 4회를 모두 쓰면 더 시작할 수 없음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      for (let i = 1; i <= 4; i++) {
        const record = await startedRecord(user, missionId);
        expect(record.attemptNo).toBe(i);
        const res = await submit(user, record.id, {
          metrics: { round: i },
        }).expect(200);
        expect(res.body.submissionNo).toBe(i);
      }
      const res = await start(user, missionId).expect(422);
      expect(res.body.error.code).toBe('VERIFY_SUBMISSION_LIMIT');
    });

    it('제출하지 못한 회차(포기)는 횟수에 넣지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      for (let i = 0; i < 3; i++) {
        const record = await startedRecord(user, missionId);
        await http
          .post(`/api/v1/records/${record.id}/abort`)
          .set(auth(user.token))
          .expect(200);
      }
      for (let i = 0; i < 4; i++) {
        const record = await startedRecord(user, missionId);
        await submit(user, record.id, { metrics: { round: i } }).expect(200);
      }
      expect((await start(user, missionId).expect(422)).body.error.code).toBe(
        'VERIFY_SUBMISSION_LIMIT',
      );
      const { rows } = await db.query(
        `SELECT attempt_no FROM mission_records WHERE mission_id = $1 ORDER BY attempt_no`,
        [missionId],
      );
      expect(rows.map((r) => r.attempt_no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('제출', () => {
    it('센서 요약: metrics가 있어야 하고 제출 번호·증거 종류가 정해지며 미션이 submitted', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'sensor' });
      const record = await startedRecord(user, missionId);

      const missing = await submit(user, record.id).expect(422);
      expect(missing.body.error.code).toBe('VERIFY_EVIDENCE_REQUIRED');
      await submit(user, record.id, { metrics: {} }).expect(422);

      const res = await submit(user, record.id, {
        metrics: { steps: 8000, minutes: 40 },
      }).expect(200);
      expect(res.body).toMatchObject({
        status: 'submitted',
        submissionNo: 1,
        evidenceKind: 'sensor_summary',
        metrics: { steps: 8000, minutes: 40 },
      });
      expect(res.body.submittedAt).toEqual(expect.any(String));
      expect(await missionStatus(missionId)).toBe('submitted');
    });

    it('센서 원시 파일이 있으면 sensor_raw, 요약은 선택', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'sensor' });
      const record = await startedRecord(user, missionId);
      const registered = await http
        .post(`/api/v1/records/${record.id}/media`)
        .set(auth(user.token))
        .send({
          mediaKind: 'sensor_raw',
          mimeType: 'application/gzip',
          sizeBytes: 500,
        })
        .expect(201);
      const { rows } = await db.query(
        'SELECT object_key FROM media_files WHERE id = $1',
        [registered.body.id],
      );

      // 확인되지 않은 업로드가 있으면 제출할 수 없음
      const pending = await submit(user, record.id).expect(422);
      expect(pending.body.error).toMatchObject({
        code: 'MEDIA_NOT_UPLOADED',
        details: { pending: 1 },
      });

      storage.simulateUpload(rows[0].object_key, {
        size: 500,
        contentType: 'application/gzip',
      });
      await http
        .post(`/api/v1/media/${registered.body.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      const res = await submit(user, record.id).expect(200);
      expect(res.body).toMatchObject({
        evidenceKind: 'sensor_raw',
        submissionNo: 1,
      });
      expect(res.body.files).toEqual([
        { id: registered.body.id, mediaKind: 'sensor_raw', status: 'uploaded' },
      ]);
    });

    it('카메라: 확인된 사진이 있어야 제출할 수 있음', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'camera' });
      const record = await startedRecord(user, missionId);

      expect(
        (await submit(user, record.id, { metrics: { a: 1 } }).expect(422)).body
          .error.code,
      ).toBe('VERIFY_EVIDENCE_REQUIRED');
      await attachPhoto(user, record.id);
      const res = await submit(user, record.id).expect(200);
      expect(res.body).toMatchObject({
        evidenceKind: 'camera_media',
        submissionNo: 1,
        status: 'submitted',
      });
    });

    it('카메라: 업로드를 마치지 않은 파일이 하나라도 있으면 거절하고, 지우면 제출할 수 있음', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'camera' });
      const record = await startedRecord(user, missionId);
      // 카메라 증거는 회차당 1개: 올리다 만 파일이 있으면 거절
      const extra = await http
        .post(`/api/v1/records/${record.id}/media`)
        .set(auth(user.token))
        .send({
          mediaKind: 'camera_photo',
          mimeType: 'image/jpeg',
          sizeBytes: MB,
        })
        .expect(201);

      expect((await submit(user, record.id).expect(422)).body.error.code).toBe(
        'MEDIA_NOT_UPLOADED',
      );
      await http
        .delete(`/api/v1/media/${extra.body.id}`)
        .set(auth(user.token))
        .expect(204);
      await attachPhoto(user, record.id);
      await submit(user, record.id).expect(200);
    });

    it('같은 회차를 다시 제출하면 현재 상태를 그대로 돌려주고 번호를 더 쓰지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const record = await startedRecord(user, missionId);
      const first = await submit(user, record.id, { metrics: { a: 1 } }).expect(
        200,
      );
      const again = await submit(user, record.id, { metrics: { a: 2 } }).expect(
        200,
      );
      expect(again.body.submissionNo).toBe(1);
      expect(again.body.submittedAt).toBe(first.body.submittedAt);
      expect(again.body.metrics).toEqual({ a: 1 });
      const { rows } = await db.query(
        'SELECT count(*)::int AS n FROM mission_records WHERE mission_id = $1 AND submission_no IS NOT NULL',
        [missionId],
      );
      expect(rows[0].n).toBe(1);
    });

    it('동시에 제출해도 제출 번호가 겹치지 않고 4회를 넘지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      // 이미 3회 제출한 상태에서 열린 회차 3개를 동시에 제출
      for (let i = 0; i < 3; i++) {
        await submit(user, (await startedRecord(user, missionId)).id, {
          metrics: { i },
        }).expect(200);
      }
      const open = [];
      for (let attempt = 4; attempt <= 6; attempt++) {
        const id = newId();
        await db.query(
          `INSERT INTO mission_records (id, mission_id, user_id, attempt_no, status)
           VALUES ($1,$2,$3,$4,'recording')`,
          [id, missionId, user.id, attempt],
        );
        open.push(id);
      }
      const results = await Promise.all(
        open.map((id) => submit(user, id, { metrics: { x: id } })),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 422);
      expect(rejected).toHaveLength(2);
      expect(
        rejected.every((r) => r.body.error.code === 'VERIFY_SUBMISSION_LIMIT'),
      ).toBe(true);
      const { rows } = await db.query(
        `SELECT submission_no FROM mission_records WHERE mission_id = $1 AND submission_no IS NOT NULL ORDER BY submission_no`,
        [missionId],
      );
      expect(rows.map((r) => r.submission_no)).toEqual([1, 2, 3, 4]);

      // 여유가 있을 때의 동시 제출은 각자 다른 번호
      const roomy = await createMission(user);
      const ids = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const id = newId();
        await db.query(
          `INSERT INTO mission_records (id, mission_id, user_id, attempt_no, status)
           VALUES ($1,$2,$3,$4,'recording')`,
          [id, roomy, user.id, attempt],
        );
        ids.push(id);
      }
      const parallel = await Promise.all(
        ids.map((id) => submit(user, id, { metrics: { y: 1 } })),
      );
      expect(parallel.every((r) => r.status === 200)).toBe(true);
      expect(parallel.map((r) => r.body.submissionNo).sort()).toEqual([
        1, 2, 3,
      ]);
    });

    it('마감이 지났거나 미션이 끝났으면 제출할 수 없음', async () => {
      const user = await createUser();
      const expired = await createMission(user, {
        dueAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const record = await startedRecord(user, expired);
      // 시작된 미션의 마감은 DB 트리거가 막으므로 시간이 흐른 상황을 트리거 밖에서 흉내
      await tx(async (t) => {
        await t.query('SET LOCAL session_replication_role = replica');
        await t.query(
          `UPDATE missions SET due_at = now() - interval '1 minute' WHERE id = $1`,
          [expired],
        );
      });
      expect(
        (await submit(user, record.id, { metrics: { a: 1 } }).expect(409)).body
          .error.code,
      ).toBe('MISSION_EXPIRED');

      for (const status of ['completed', 'cancelled', 'failed']) {
        const missionId = await createMission(user);
        const open = await startedRecord(user, missionId);
        await db.query(
          `UPDATE missions
              SET status = $2,
                  cancel_reason = CASE WHEN $3::text = 'cancelled' THEN 'user_cancelled' END,
                  cancelled_at = CASE WHEN $3::text = 'cancelled' THEN now() END
            WHERE id = $1`,
          [missionId, status, status],
        );
        const res = await submit(user, open.id, { metrics: { a: 1 } }).expect(
          409,
        );
        expect(res.body.error).toMatchObject({
          code: 'MISSION_CLOSED',
          details: { status },
        });
      }
    });

    it('포기한 회차와 남의 회차는 제출할 수 없고 metrics 형식도 검사', async () => {
      const user = await createUser();
      const other = await createUser();
      const missionId = await createMission(user);
      const record = await startedRecord(user, missionId);
      await submit(other, record.id, { metrics: { a: 1 } }).expect(404);
      await submit(user, newId()).expect(404);
      await submit(user, record.id, { metrics: 'x' }).expect(400);
      await submit(user, record.id, { metrics: [1, 2] }).expect(400);
      await submit(user, record.id, {
        metrics: { blob: 'a'.repeat(20_000) },
      }).expect(400);
      await http
        .post('/api/v1/records/not-a-uuid/submit')
        .set(auth(user.token))
        .send({})
        .expect(400);

      await http
        .post(`/api/v1/records/${record.id}/abort`)
        .set(auth(user.token))
        .expect(200);
      const res = await submit(user, record.id, { metrics: { a: 1 } }).expect(
        409,
      );
      expect(res.body.error).toMatchObject({
        code: 'VERIFY_RECORD_NOT_OPEN',
        details: { status: 'aborted' },
      });
    });
  });

  describe('포기', () => {
    it('회차를 aborted로 바꾸고 파일을 정리하며, 살아 있는 회차가 없으면 미션을 시작 전으로 되돌림', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'camera' });
      const record = await startedRecord(user, missionId);
      const photo = await attachPhoto(user, record.id);
      expect(storage.has(photo.key)).toBe(true);

      const res = await http
        .post(`/api/v1/records/${record.id}/abort`)
        .set(auth(user.token))
        .expect(200);
      expect(res.body).toMatchObject({ status: 'aborted', files: [] });
      expect(res.body.completedAt).toEqual(expect.any(String));
      expect(storage.has(photo.key)).toBe(false);
      expect(await missionStatus(missionId)).toBe('scheduled');
      const { rows } = await db.query(
        'SELECT upload_status FROM media_files WHERE id = $1',
        [photo.id],
      );
      expect(rows[0].upload_status).toBe('deleted');

      // 다시 호출해도 같은 결과, 포기 뒤에 새로 시작할 수 있음
      await http
        .post(`/api/v1/records/${record.id}/abort`)
        .set(auth(user.token))
        .expect(200);
      const next = await start(user, missionId).expect(201);
      expect(next.body.attemptNo).toBe(2);
    });

    it('다른 제출이 있으면 미션 상태는 유지, 제출한 회차는 포기할 수 없음', async () => {
      const user = await createUser();
      const other = await createUser();
      const missionId = await createMission(user);
      const submitted = await startedRecord(user, missionId);
      await submit(user, submitted.id, { metrics: { a: 1 } }).expect(200);
      const second = await start(user, missionId).expect(201);

      await http
        .post(`/api/v1/records/${second.body.id}/abort`)
        .set(auth(user.token))
        .expect(200);
      expect(await missionStatus(missionId)).toBe('submitted');

      const res = await http
        .post(`/api/v1/records/${submitted.id}/abort`)
        .set(auth(user.token))
        .expect(409);
      expect(res.body.error).toMatchObject({
        code: 'VERIFY_RECORD_NOT_OPEN',
        details: { status: 'submitted' },
      });
      await http
        .post(`/api/v1/records/${second.body.id}/abort`)
        .set(auth(other.token))
        .expect(404);
    });

    it('파일 정리가 R2 장애로 실패해도 포기는 성공하고 파일은 deleting으로 남음', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'camera' });
      const record = await startedRecord(user, missionId);
      const photo = await attachPhoto(user, record.id);

      const original = storage.delete.bind(storage);
      storage.delete = async () => {
        throw new Error('R2 장애');
      };
      try {
        await http
          .post(`/api/v1/records/${record.id}/abort`)
          .set(auth(user.token))
          .expect(200);
      } finally {
        storage.delete = original;
      }
      const { rows } = await db.query(
        'SELECT upload_status FROM media_files WHERE id = $1',
        [photo.id],
      );
      expect(rows[0].upload_status).toBe('deleting');
      expect(storage.has(photo.key)).toBe(true);
    });
  });

  describe('조회', () => {
    it('미션의 회차를 시작 순으로 보여 주고 남의 미션은 404', async () => {
      const user = await createUser();
      const other = await createUser();
      const missionId = await createMission(user);
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const record = await startedRecord(user, missionId);
        ids.push(record.id);
        if (i < 2)
          await submit(user, record.id, { metrics: { i } }).expect(200);
      }
      const res = await http
        .get(`/api/v1/missions/${missionId}/records`)
        .set(auth(user.token))
        .expect(200);
      expect(res.body.items.map((r) => [r.id, r.attemptNo, r.status])).toEqual([
        [ids[0], 1, 'submitted'],
        [ids[1], 2, 'submitted'],
        [ids[2], 3, 'recording'],
      ]);

      await http
        .get(`/api/v1/missions/${missionId}/records`)
        .set(auth(other.token))
        .expect(404);
      await http
        .get(`/api/v1/missions/${newId()}/records`)
        .set(auth(user.token))
        .expect(404);
      const one = await http
        .get(`/api/v1/records/${ids[1]}`)
        .set(auth(user.token))
        .expect(200);
      expect(one.body.submissionNo).toBe(2);
      await http
        .get(`/api/v1/records/${ids[1]}`)
        .set(auth(other.token))
        .expect(404);
      await http
        .get('/api/v1/records/not-a-uuid')
        .set(auth(user.token))
        .expect(400);
    });

    it('판정 요약: 안내 전 판정의 사유는 숨기고, 거절은 이의 제기 가능 여부와 기한을 보여 줌', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const make = async () => {
        const record = await startedRecord(user, missionId);
        await submit(user, record.id, { metrics: { a: 1 } }).expect(200);
        return record.id;
      };
      const pending = await make();
      const rejected = await make();
      const old = await make();
      const appealed = await make();
      // 제출은 미션당 4회까지라 승인된 회차는 다른 미션에 둠
      const approvedMission = await createMission(user);
      const approvedRecord = await startedRecord(user, approvedMission);
      await submit(user, approvedRecord.id, { metrics: { a: 1 } }).expect(200);
      const approved = approvedRecord.id;
      await insertResult(pending, {
        decision: 'review_required',
        notified: false,
        reason: 'AI 의견',
      });
      await insertResult(rejected, {
        decision: 'rejected',
        ageDays: 0,
        reason: '기준 미달',
      });
      await insertResult(old, {
        decision: 'rejected',
        ageDays: 8,
        reason: '기준 미달',
      });
      const appealedResult = await insertResult(appealed, {
        decision: 'rejected',
        ageDays: 1,
        reason: '기준 미달',
      });
      await insertResult(approved, { decision: 'approved', reason: '충족' });
      await db.query(
        `INSERT INTO verification_appeals (id, record_id, filed_by_user_id, original_result_id, reason)
         VALUES ($1,$2,$3,$4,'다시 봐주세요')`,
        [newId(), appealed, user.id, appealedResult],
      );

      const listOf = async (id) =>
        (
          await http
            .get(`/api/v1/missions/${id}/records`)
            .set(auth(user.token))
            .expect(200)
        ).body.items;
      const byId = Object.fromEntries(
        [...(await listOf(missionId)), ...(await listOf(approvedMission))].map(
          (r) => [r.id, r],
        ),
      );

      expect(byId[pending].result).toMatchObject({
        decision: 'review_required',
        source: 'ai',
        reason: null,
        notified: false,
      });
      expect(byId[pending].appeal).toBeNull();

      expect(byId[rejected].result).toMatchObject({
        decision: 'rejected',
        reason: '기준 미달',
        notified: true,
      });
      expect(byId[rejected].appeal).toMatchObject({
        status: null,
        canFile: true,
      });
      const deadline =
        Date.parse(byId[rejected].appeal.deadline) -
        Date.parse(byId[rejected].result.decidedAt);
      expect(deadline).toBe(7 * 86_400_000);

      expect(byId[old].appeal).toMatchObject({ status: null, canFile: false });
      expect(byId[appealed].appeal).toMatchObject({
        status: 'open',
        canFile: false,
      });
      expect(byId[approved].result).toMatchObject({
        decision: 'approved',
        reason: '충족',
      });
      expect(byId[approved].appeal).toBeNull();
    });
  });

  describe('이용 제한', () => {
    it('제한 중에는 시작·제출을 막고 포기·조회는 허용', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const record = await startedRecord(user, missionId);
      const other = await createMission(user);
      await db.query(
        `INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','사유', now() - interval '1 hour', now() + interval '1 hour')`,
        [newId(), user.id, adminId],
      );

      expect((await start(user, other).expect(403)).body.error.code).toBe(
        'AUTH_ACCOUNT_RESTRICTED',
      );
      expect(
        (await submit(user, record.id, { metrics: { a: 1 } }).expect(403)).body
          .error.code,
      ).toBe('AUTH_ACCOUNT_RESTRICTED');
      await http
        .get(`/api/v1/missions/${missionId}/records`)
        .set(auth(user.token))
        .expect(200);
      await http
        .get(`/api/v1/records/${record.id}`)
        .set(auth(user.token))
        .expect(200);
      await http
        .post(`/api/v1/records/${record.id}/abort`)
        .set(auth(user.token))
        .expect(200);
    });
  });
});
