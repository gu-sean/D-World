import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { MediaService } from '../../src/media/media.service.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게
const MB = 1024 * 1024;

describe.skipIf(!databaseUrl)('미디어·R2 (PostgreSQL + 메모리 저장소)', () => {
  let app;
  let db;
  let http;
  let storage;
  let media;
  let adminId;
  let categoryId;
  let difficultyId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const createUser = () => createUserWith(app, db);

  /** 수행 회차를 API를 거치지 않고 직접 만듦 */
  async function createRecord(
    user,
    { method = 'camera', status = 'recording' } = {},
  ) {
    const missionId = newId();
    const recordId = newId();
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date, status)
       VALUES ($1,$2,'user','인증 미션',$3,$4,$5,$6,'in_progress')`,
      [missionId, user.id, categoryId, difficultyId, method, kstDate()],
    );
    await db.query(
      `INSERT INTO mission_records (id, mission_id, user_id, attempt_no, status)
       VALUES ($1,$2,$3,1,'recording')`,
      [recordId, missionId, user.id],
    );
    if (status !== 'recording') {
      await db.query(`UPDATE mission_records SET status = $2 WHERE id = $1`, [
        recordId,
        status,
      ]);
    }
    return recordId;
  }

  const photo = (overrides = {}) => ({
    mediaKind: 'camera_photo',
    mimeType: 'image/jpeg',
    sizeBytes: 2 * MB,
    ...overrides,
  });

  const register = (user, recordId, payload = photo()) =>
    http
      .post(`/api/v1/records/${recordId}/media`)
      .set(auth(user.token))
      .send(payload);

  const registered = async (user, recordId, payload) =>
    (await register(user, recordId, payload).expect(201)).body;

  const keyOf = async (mediaId) =>
    (
      await db.query('SELECT object_key FROM media_files WHERE id = $1', [
        mediaId,
      ])
    ).rows[0].object_key;
  const statusOf = async (mediaId) =>
    (
      await db.query('SELECT upload_status FROM media_files WHERE id = $1', [
        mediaId,
      ])
    ).rows[0].upload_status;
  const recordStatus = async (recordId) =>
    (
      await db.query('SELECT status FROM mission_records WHERE id = $1', [
        recordId,
      ])
    ).rows[0].status;

  /** 앱이 업로드 URL로 파일을 올린 상황 */
  async function upload(mediaId, overrides = {}) {
    const { rows } = await db.query(
      'SELECT object_key, expected_size_bytes, mime_type FROM media_files WHERE id = $1',
      [mediaId],
    );
    storage.simulateUpload(rows[0].object_key, {
      size: Number(rows[0].expected_size_bytes),
      contentType: rows[0].mime_type,
      ...overrides,
    });
    return rows[0].object_key;
  }

  const expire = (mediaId) =>
    db.query(
      `UPDATE media_files
          SET created_at = now() - interval '10 minutes',
              upload_url_expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [mediaId],
    );

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    storage = app.get(OBJECT_STORAGE);
    media = app.get(MediaService);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `md_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    categoryId = newId();
    difficultyId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `mdc${RUN}`, `미디어카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `mdd${RUN}`, `미디어난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('업로드 등록', () => {
    it('서명된 업로드 URL을 돌려주고 객체 키는 노출하지 않으며 회차가 uploading이 됨', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const res = await register(
        user,
        recordId,
        photo({ checksumSha256: 'A'.repeat(64) }),
      ).expect(201);

      expect(res.body).toMatchObject({
        recordId,
        mediaKind: 'camera_photo',
        mimeType: 'image/jpeg',
        sizeBytes: 2 * MB,
        actualSizeBytes: null,
        status: 'pending',
        checksumSha256: 'a'.repeat(64),
      });
      expect(res.body.upload.url).toEqual(expect.any(String));
      expect(res.body.upload.headers['Content-Type']).toBe('image/jpeg');
      const ttl = Date.parse(res.body.upload.expiresAt) - Date.now();
      expect(ttl).toBeGreaterThan(850_000);
      expect(ttl).toBeLessThanOrEqual(900_000);
      // 객체 키는 서명된 업로드 URL 안에만 있고 별도 필드로는 노출하지 않음
      expect(res.body).not.toHaveProperty('objectKey');
      expect(res.body).not.toHaveProperty('object_key');

      const key = await keyOf(res.body.id);
      expect(key).toMatch(
        new RegExp(
          `^dev/users/${user.id}/records/${recordId}/${res.body.id}\.jpg$`,
        ),
      );
      expect(res.body.upload.url).toContain(key);
      expect(await recordStatus(recordId)).toBe('uploading');
    });

    it('형식·크기·종류를 검증하고 인증 방식에 맞지 않는 종류는 거절', async () => {
      const user = await createUser();
      const cameraRecord = await createRecord(user, { method: 'camera' });
      const sensorRecord = await createRecord(user, { method: 'sensor' });

      const cases = [
        [cameraRecord, photo({ mimeType: 'image/gif' }), 'mime_type'],
        [
          cameraRecord,
          photo({ mimeType: 'image/jpeg; charset=x', sizeBytes: 11 * MB }),
          'too_large',
        ],
        [
          cameraRecord,
          {
            mediaKind: 'camera_video',
            mimeType: 'video/mp4',
            sizeBytes: 101 * MB,
          },
          'too_large',
        ],
        [
          cameraRecord,
          {
            mediaKind: 'sensor_raw',
            mimeType: 'application/gzip',
            sizeBytes: 100,
          },
          'kind_not_allowed_for_method',
        ],
        [sensorRecord, photo(), 'kind_not_allowed_for_method'],
        [
          sensorRecord,
          {
            mediaKind: 'sensor_raw',
            mimeType: 'application/gzip',
            sizeBytes: 6 * MB,
          },
          'too_large',
        ],
        [
          sensorRecord,
          { mediaKind: 'sensor_raw', mimeType: 'text/plain', sizeBytes: 100 },
          'mime_type',
        ],
      ];
      for (const [recordId, payload, reason] of cases) {
        const res = await register(user, recordId, payload).expect(400);
        expect(res.body.error.code, JSON.stringify(payload)).toBe(
          'MEDIA_TYPE_NOT_ALLOWED',
        );
        expect(res.body.error.details.reason).toBe(reason);
      }
      // MIME의 대소문자·매개변수는 정규화
      const normalized = await registered(
        user,
        cameraRecord,
        photo({ mimeType: 'IMAGE/JPEG; q=1' }),
      );
      expect(normalized.mimeType).toBe('image/jpeg');
      await registered(user, sensorRecord, {
        mediaKind: 'sensor_raw',
        mimeType: 'application/gzip',
        sizeBytes: 1000,
      });
    });

    it('입력 형식 오류는 400', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      for (const payload of [
        {},
        photo({ mediaKind: 'x' }),
        photo({ sizeBytes: 0 }),
        photo({ sizeBytes: 1.5 }),
        photo({ mimeType: 'a' }),
        photo({ checksumSha256: 'zz' }),
      ]) {
        const res = await register(user, recordId, payload);
        expect(res.status, JSON.stringify(payload)).toBe(400);
      }
      await http
        .post('/api/v1/records/not-a-uuid/media')
        .set(auth(user.token))
        .send(photo())
        .expect(400);
      await http
        .post(`/api/v1/records/${recordId}/media`)
        .send(photo())
        .expect(401);
    });

    it('카메라 증거는 사진·영상 합쳐 회차당 1개, 동시 등록에서도 넘지 않음', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);

      const results = await Promise.all(
        [1, 2, 3, 4].map(() => register(user, recordId)),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      const over = results.find((r) => r.status === 409);
      expect(over.body.error).toMatchObject({
        code: 'MEDIA_LIMIT_REACHED',
        details: { mediaKind: 'camera_photo' },
      });

      const video = {
        mediaKind: 'camera_video',
        mimeType: 'video/mp4',
        sizeBytes: 20 * MB,
      };
      // 사진이 이미 있으면 영상도 올릴 수 없음
      expect(
        (await register(user, recordId, video).expect(409)).body.error.code,
      ).toBe('MEDIA_LIMIT_REACHED');

      // 다른 회차에서 영상 1개 뒤의 사진도 거절
      const other = await createRecord(user);
      await registered(user, other, video);
      expect((await register(user, other).expect(409)).body.error.code).toBe(
        'MEDIA_LIMIT_REACHED',
      );
    });

    it('실패·삭제된 파일은 개수에서 제외', async () => {
      const sensorUser = await createUser();
      const sensorRecord = await createRecord(sensorUser, { method: 'sensor' });
      const raw = {
        mediaKind: 'sensor_raw',
        mimeType: 'application/gzip',
        sizeBytes: 10,
      };
      const one = await registered(sensorUser, sensorRecord, raw);
      await register(sensorUser, sensorRecord, raw).expect(409);
      await http
        .delete(`/api/v1/media/${one.id}`)
        .set(auth(sensorUser.token))
        .expect(204);
      await registered(sensorUser, sensorRecord, raw);
    });

    it('남의 회차는 404, 열려 있지 않은 회차는 409', async () => {
      const user = await createUser();
      const other = await createUser();
      const recordId = await createRecord(user);
      const stranger = await register(other, recordId).expect(404);
      expect(stranger.body.error.code).toBe('RECORD_NOT_FOUND');
      await register(user, newId()).expect(404);

      for (const status of ['aborted']) {
        const closed = await createRecord(user, { status });
        const res = await register(user, closed).expect(409);
        expect(res.body.error).toMatchObject({
          code: 'VERIFY_RECORD_NOT_OPEN',
          details: { status },
        });
      }
    });
  });

  describe('업로드 확인', () => {
    it('R2에 올라온 것이 확인되면 uploaded, 크기를 기록하고 반복 호출은 같은 결과', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      await upload(m.id);

      const done = await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      expect(done.body).toMatchObject({
        id: m.id,
        status: 'uploaded',
        actualSizeBytes: 2 * MB,
      });
      expect(done.body.uploadedAt).toEqual(expect.any(String));
      const again = await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      expect(again.body.uploadedAt).toBe(done.body.uploadedAt);
    });

    it('아직 올라오지 않았으면 422이고 pending 상태를 유지, 올린 뒤 다시 호출하면 성공', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);

      const res = await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(422);
      expect(res.body.error).toMatchObject({
        code: 'MEDIA_NOT_UPLOADED',
        details: { expired: false },
      });
      expect(await statusOf(m.id)).toBe('pending');

      await expire(m.id);
      const expired = await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(422);
      expect(expired.body.error.details.expired).toBe(true);

      await upload(m.id);
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);
    });

    it('신고와 다른 크기·형식·체크섬은 failed로 바꾸고 올라온 객체를 지움', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const wrong = [
        [{ size: 1 * MB }, 'size'],
        [{ contentType: 'image/png' }, 'content_type'],
        [{ checksumSha256: 'b'.repeat(64) }, 'checksum'],
      ];
      for (const [override, reason] of wrong) {
        const m = await registered(
          user,
          recordId,
          photo({ checksumSha256: 'a'.repeat(64) }),
        );
        const key = await upload(m.id, {
          checksumSha256: 'a'.repeat(64),
          ...override,
        });
        const res = await http
          .post(`/api/v1/media/${m.id}/complete`)
          .set(auth(user.token))
          .expect(422);
        expect(res.body.error).toMatchObject({
          code: 'UPLOAD_MISMATCH',
          details: { reason },
        });
        expect(await statusOf(m.id)).toBe('failed');
        expect(storage.has(key)).toBe(false);
        // failed는 개수에서 빠지므로 계속 등록 가능
        await http
          .delete(`/api/v1/media/${m.id}`)
          .set(auth(user.token))
          .expect(204);
      }
    });

    it('체크섬을 신고하지 않아도 R2가 확인한 체크섬을 저장', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      await upload(m.id, { checksumSha256: 'c'.repeat(64) });
      const done = await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      expect(done.body.checksumSha256).toBe('c'.repeat(64));
    });

    it('남의 파일은 404, 실패·삭제된 파일은 확인할 수 없고, 닫힌 회차에서는 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      await upload(m.id);
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(other.token))
        .expect(404);
      await http
        .post(`/api/v1/media/${newId()}/complete`)
        .set(auth(user.token))
        .expect(404);

      // 카메라 증거는 회차당 1개라 파일마다 다른 회차를 쓴다
      const pending = await registered(user, await createRecord(user));
      await db.query(
        `UPDATE media_files SET upload_status = 'failed' WHERE id = $1`,
        [pending.id],
      );
      const failed = await http
        .post(`/api/v1/media/${pending.id}/complete`)
        .set(auth(user.token))
        .expect(409);
      expect(failed.body.error).toMatchObject({
        code: 'MEDIA_NOT_PENDING',
        details: { status: 'failed' },
      });

      const closedRecordId = await createRecord(user);
      const another = await registered(user, closedRecordId);
      await upload(another.id);
      await db.query(
        `UPDATE mission_records SET status = 'aborted' WHERE id = $1`,
        [closedRecordId],
      );
      const closed = await http
        .post(`/api/v1/media/${another.id}/complete`)
        .set(auth(user.token))
        .expect(409);
      expect(closed.body.error.code).toBe('VERIFY_RECORD_NOT_OPEN');
    });
  });

  describe('재시도', () => {
    it('만료된 업로드는 같은 키로 새 URL을 받고 이전의 불완전한 객체는 지워짐', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      const key = await upload(m.id, { size: 1000 }); // 중간에 끊긴 불완전 업로드
      await expire(m.id);

      const res = await http
        .post(`/api/v1/media/${m.id}/retry`)
        .set(auth(user.token))
        .expect(200);
      expect(res.body).toMatchObject({ id: m.id, status: 'pending' });
      expect(Date.parse(res.body.upload.expiresAt)).toBeGreaterThan(Date.now());
      expect(res.body.upload.url).toContain(key);
      expect(storage.has(key)).toBe(false);

      await upload(m.id);
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);
    });

    it('failed 파일도 다시 시도할 수 있고, 확인된 파일·삭제된 파일은 거절', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      await upload(m.id, { size: 1 });
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(422);
      expect(await statusOf(m.id)).toBe('failed');

      const retried = await http
        .post(`/api/v1/media/${m.id}/retry`)
        .set(auth(user.token))
        .expect(200);
      expect(retried.body.status).toBe('pending');
      await upload(m.id);
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);

      const uploaded = await http
        .post(`/api/v1/media/${m.id}/retry`)
        .set(auth(user.token))
        .expect(409);
      expect(uploaded.body.error.code).toBe('MEDIA_ALREADY_UPLOADED');

      const gone = await registered(user, await createRecord(user));
      await http
        .delete(`/api/v1/media/${gone.id}`)
        .set(auth(user.token))
        .expect(204);
      const deleted = await http
        .post(`/api/v1/media/${gone.id}/retry`)
        .set(auth(user.token))
        .expect(409);
      expect(deleted.body.error.code).toBe('MEDIA_NOT_PENDING');
    });
  });

  describe('삭제', () => {
    it('업로드 전 파일은 바로 deleted, 확인된 파일은 R2 삭제 후 deleted이고 개수가 비워짐', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const pending = await registered(user, recordId);
      const pendingKey = await upload(pending.id, { size: 5 }); // 올리다 만 객체
      await http
        .delete(`/api/v1/media/${pending.id}`)
        .set(auth(user.token))
        .expect(204);
      expect(await statusOf(pending.id)).toBe('deleted');
      expect(storage.has(pendingKey)).toBe(false);

      const confirmed = await registered(user, recordId);
      const key = await upload(confirmed.id);
      await http
        .post(`/api/v1/media/${confirmed.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      await http
        .delete(`/api/v1/media/${confirmed.id}`)
        .set(auth(user.token))
        .expect(204);
      expect(await statusOf(confirmed.id)).toBe('deleted');
      expect(storage.has(key)).toBe(false);
      const { rows } = await db.query(
        'SELECT deleted_at FROM media_files WHERE id = $1',
        [confirmed.id],
      );
      expect(rows[0].deleted_at).not.toBeNull();

      // 같은 요청을 다시 보내도 성공, 목록에는 나오지 않음
      await http
        .delete(`/api/v1/media/${confirmed.id}`)
        .set(auth(user.token))
        .expect(204);
      const list = await http
        .get(`/api/v1/records/${recordId}/media`)
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items).toEqual([]);
    });

    it('R2 삭제가 실패하면 deleting으로 남고 작업이 마무리, 남의 파일·제출된 회차는 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      const key = await upload(m.id);
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);

      await http
        .delete(`/api/v1/media/${m.id}`)
        .set(auth(other.token))
        .expect(404);

      const original = storage.delete.bind(storage);
      storage.delete = async () => {
        throw new Error('R2 일시 장애');
      };
      try {
        await http
          .delete(`/api/v1/media/${m.id}`)
          .set(auth(user.token))
          .expect(204);
      } finally {
        storage.delete = original;
      }
      expect(await statusOf(m.id)).toBe('deleting');
      expect(storage.has(key)).toBe(true);

      expect(await media.finishDeletions({ limit: 10_000 })).toMatchObject({
        deleted: expect.any(Number),
      });
      expect(await statusOf(m.id)).toBe('deleted');
      expect(storage.has(key)).toBe(false);

      const submitted = await createRecord(user, { status: 'aborted' });
      const pendingFile = await db.query(
        `INSERT INTO media_files (id, user_id, record_id, object_key, media_kind, mime_type,
                                  expected_size_bytes, upload_url_expires_at)
         VALUES ($1,$2,$3,$4,'camera_photo','image/jpeg',10, now() + interval '5 minutes')
         RETURNING id`,
        [
          newId(),
          user.id,
          submitted,
          `dev/users/${user.id}/records/${submitted}/x.jpg`,
        ],
      );
      const res = await http
        .delete(`/api/v1/media/${pendingFile.rows[0].id}`)
        .set(auth(user.token))
        .expect(409);
      expect(res.body.error.code).toBe('VERIFY_RECORD_NOT_OPEN');
    });
  });

  describe('조회', () => {
    it('목록은 객체 키 없이 상태만, 조회 URL은 확인된 파일만 짧은 유효 시간으로', async () => {
      const user = await createUser();
      const other = await createUser();
      const recordId = await createRecord(user);
      const done = await registered(user, recordId);
      const key = await upload(done.id);
      await http
        .post(`/api/v1/media/${done.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      const pending = await registered(user, await createRecord(user));

      const list = await http
        .get(`/api/v1/records/${recordId}/media`)
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items.map((i) => [i.id, i.status])).toEqual([
        [done.id, 'uploaded'],
      ]);
      expect(JSON.stringify(list.body)).not.toContain('object_key');
      expect(JSON.stringify(list.body)).not.toContain(key);
      await http
        .get(`/api/v1/records/${recordId}/media`)
        .set(auth(other.token))
        .expect(404);

      const url = await http
        .get(`/api/v1/media/${done.id}/url`)
        .set(auth(user.token))
        .expect(200);
      expect(url.body.url).toContain(key);
      expect(Date.parse(url.body.expiresAt) - Date.now()).toBeLessThanOrEqual(
        3_600_000,
      );
      const notReady = await http
        .get(`/api/v1/media/${pending.id}/url`)
        .set(auth(user.token))
        .expect(422);
      expect(notReady.body.error).toMatchObject({
        code: 'MEDIA_NOT_UPLOADED',
        details: { status: 'pending' },
      });
      await http
        .get(`/api/v1/media/${done.id}/url`)
        .set(auth(other.token))
        .expect(404);
    });
  });

  describe('작업', () => {
    it('만료된 pending 정리: 맞게 올라온 파일은 uploaded, 나머지는 failed로 바꾸고 객체를 지움', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const good = await registered(user, recordId);
      const lost = await registered(user, await createRecord(user));
      const broken = await registered(user, await createRecord(user));
      const fresh = await registered(user, await createRecord(user));
      await upload(good.id);
      const brokenKey = await upload(broken.id, { size: 7 });
      await expire(good.id);
      await expire(lost.id);
      await expire(broken.id);

      const result = await media.reconcileExpiredPending({ limit: 10_000 });
      expect(result.uploaded).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBeGreaterThanOrEqual(2);
      expect(await statusOf(good.id)).toBe('uploaded');
      expect(await statusOf(lost.id)).toBe('failed');
      expect(await statusOf(broken.id)).toBe('failed');
      expect(storage.has(brokenKey)).toBe(false);
      expect(await statusOf(fresh.id)).toBe('pending'); // 아직 만료 전
    });

    it('탈퇴 정리: 사용자의 모든 파일을 지우고 deleted가 아닌 파일이 없어야 계정 삭제가 가능', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const keys = [];
      for (let i = 0; i < 2; i++) {
        const m = await registered(
          user,
          i === 0 ? recordId : await createRecord(user),
        );
        keys.push(await upload(m.id));
        await http
          .post(`/api/v1/media/${m.id}/complete`)
          .set(auth(user.token))
          .expect(200);
      }
      const pending = await registered(user, await createRecord(user));
      keys.push(await upload(pending.id, { size: 3 }));

      // 파일이 남아 있으면 DB가 계정 삭제를 막음
      await expect(
        db.query('DELETE FROM users WHERE id = $1', [user.id]),
      ).rejects.toMatchObject({
        code: '23514',
      });

      expect(
        await media.deleteAllForUser(user.id, { limit: 100 }),
      ).toMatchObject({
        deleted: 3,
        remaining: 0,
      });
      expect(keys.every((key) => !storage.has(key))).toBe(true);
      const { rows } = await db.query(
        `SELECT count(*)::int AS n FROM media_files WHERE user_id = $1 AND upload_status <> 'deleted'`,
        [user.id],
      );
      expect(rows[0].n).toBe(0);
      // 다시 실행해도 안전
      expect(await media.deleteAllForUser(user.id)).toMatchObject({
        deleted: 0,
        remaining: 0,
      });
    });

    it('R2 삭제가 실패한 파일은 남겨 두고 다음 실행에서 이어서 처리', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      const key = await upload(m.id);
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);

      const original = storage.delete.bind(storage);
      storage.delete = async () => {
        throw new Error('R2 장애');
      };
      let first;
      try {
        first = await media.deleteAllForUser(user.id);
      } finally {
        storage.delete = original;
      }
      expect(first).toMatchObject({ deleted: 0, remaining: 1 });
      expect(await statusOf(m.id)).toBe('deleting');
      expect(storage.has(key)).toBe(true);

      expect(await media.deleteAllForUser(user.id)).toMatchObject({
        deleted: 1,
        remaining: 0,
      });
      expect(storage.has(key)).toBe(false);
    });
  });

  describe('이용 제한', () => {
    it('제한 중에는 새 업로드 등록만 막고 확인·재시도·삭제·조회는 허용', async () => {
      const user = await createUser();
      const recordId = await createRecord(user);
      const m = await registered(user, recordId);
      await upload(m.id);
      await db.query(
        `INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','사유', now() - interval '1 hour', now() + interval '1 hour')`,
        [newId(), user.id, adminId],
      );

      const blocked = await register(user, recordId).expect(403);
      expect(blocked.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');
      await http
        .post(`/api/v1/media/${m.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      await http
        .get(`/api/v1/records/${recordId}/media`)
        .set(auth(user.token))
        .expect(200);
      await http
        .get(`/api/v1/media/${m.id}/url`)
        .set(auth(user.token))
        .expect(200);
      await http
        .delete(`/api/v1/media/${m.id}`)
        .set(auth(user.token))
        .expect(204);
    });
  });
});
