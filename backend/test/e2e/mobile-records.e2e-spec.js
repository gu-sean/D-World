import { randomInt, randomUUID } from 'node:crypto';
import { kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

const RECORD_KEYS = [
  'appeal',
  'attemptNo',
  'canAppeal',
  'completedAt',
  'currentResult',
  'evidenceKind',
  'files',
  'id',
  'media',
  'metrics',
  'mission',
  'missionId',
  'pollAfterMs',
  'result',
  'rewards',
  'startedAt',
  'status',
  'submissionNo',
  'submittedAt',
];

describe.skipIf(!databaseUrl)(
  '모바일 수행 인증 API A40~A46 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let ref;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      const adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `mr_${RUN}`, `${adminId}@example.com`],
      );
      const category = randomUUID();
      const difficulty = randomUUID();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `mrc${RUN}`, `모바일인증${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `mrd${RUN}`, `모바일인증난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [randomUUID(), category, difficulty, adminId],
      );
      ref = { categoryCode: `mrc${RUN}`, difficultyCode: `mrd${RUN}` };
    });

    afterAll(() => app.close());

    async function todayMission(user) {
      const res = await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send({
          title: '스쿼트 20개',
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          exerciseCode: 'squat',
          verificationMethod: 'camera',
          targetValue: 20,
          targetUnit: 'reps',
          scheduledDate: kstDate(),
        })
        .expect(201);
      return res.body;
    }

    it('A40 시작 → A41 조회 → A42 그만하기(204)', async () => {
      const user = await createUserWith(app, db);
      const mission = await todayMission(user);

      const started = await http
        .post(`/api/v1/missions/${mission.id}/records`)
        .set(auth(user))
        .expect(201);
      expect(started.body.status).toBe('recording');
      for (const key of RECORD_KEYS) expect(started.body).toHaveProperty(key);
      expect(started.body.mission).toEqual({
        id: mission.id,
        status: 'in_progress',
        remainingSubmissions: 4,
      });
      expect(started.body).toMatchObject({
        currentResult: null,
        rewards: null,
        canAppeal: false,
        pollAfterMs: 2000,
      });

      const got = await http
        .get(`/api/v1/mission-records/${started.body.id}`)
        .set(auth(user))
        .expect(200);
      expect(got.body.id).toBe(started.body.id);

      await http
        .post(`/api/v1/mission-records/${started.body.id}/abort`)
        .set(auth(user))
        .expect(204);
      const after = await http
        .get(`/api/v1/mission-records/${started.body.id}`)
        .set(auth(user))
        .expect(200);
      expect(after.body.status).toBe('aborted');
      expect(after.body.pollAfterMs).toBeNull();
    });

    it('A43 업로드 URL(MediaUploadTicket), A44 업로드 전 확인은 거절', async () => {
      const user = await createUserWith(app, db);
      const mission = await todayMission(user);
      const record = await http
        .post(`/api/v1/missions/${mission.id}/records`)
        .set(auth(user))
        .expect(201);

      const ticket = await http
        .post(`/api/v1/mission-records/${record.body.id}/media`)
        .set(auth(user))
        .send({
          mediaKind: 'camera_video',
          mimeType: 'video/mp4',
          sizeBytes: 1024,
          checksumSha256: 'a'.repeat(64),
        })
        .expect(201);
      expect(Object.keys(ticket.body).sort()).toEqual([
        'expiresAt',
        'mediaId',
        'uploadHeaders',
        'uploadMethod',
        'uploadUrl',
      ]);
      expect(ticket.body.uploadMethod).toBe('PUT');

      // 저장소에 올리지 않았으면 확인이 거절됨
      await http
        .post(`/api/v1/media/${ticket.body.mediaId}/complete`)
        .set(auth(user))
        .expect(422);

      const got = await http
        .get(`/api/v1/mission-records/${record.body.id}`)
        .set(auth(user))
        .expect(200);
      expect(got.body.media[0]).toEqual(
        expect.objectContaining({
          mediaId: ticket.body.mediaId,
          mediaKind: 'camera_video',
          uploadStatus: 'pending',
        }),
      );
    });

    it('A46 없는 판정 ID는 404, 사유가 짧으면 400', async () => {
      const user = await createUserWith(app, db);
      await http
        .post(`/api/v1/verification-results/${randomUUID()}/appeals`)
        .set(auth(user))
        .send({ reason: '자세가 정확했다고 생각해요.' })
        .expect(404);
      await http
        .post(`/api/v1/verification-results/${randomUUID()}/appeals`)
        .set(auth(user))
        .send({ reason: '짧음' })
        .expect(400);
    });
  },
);
