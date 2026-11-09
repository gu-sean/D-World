import { randomInt, randomUUID } from 'node:crypto';
import { testNickname } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { JobsService } from '../../src/jobs/jobs.service.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';
import { PUSH_SENDER } from '../../src/notices/push/push-sender.js';

// 푸시 발송(push-send)과 탈퇴 완료(withdrawal-complete) 정기 작업
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('운영 정기 작업 (PostgreSQL)', () => {
  let app;
  let db;
  let jobs;
  let sender;
  let adminId;
  let originalSend;

  async function createUser() {
    const id = randomUUID();
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query(
      'INSERT INTO profiles (user_id, nickname, notification_enabled) VALUES ($1, $2, true)',
      [id, testNickname('푸시')],
    );
    return id;
  }

  async function addDevice(userId, token = `tok-${randomUUID()}`) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO push_devices (id, user_id, platform, token) VALUES ($1, $2, 'android', $3)`,
      [id, userId, token],
    );
    return { id, token };
  }

  async function addNotification(userId) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO user_notifications
         (id, user_id, kind, event_key, title, body, push_status)
       VALUES ($1, $2, 'system', $3, '제목', '내용', 'pending')`,
      [id, userId, `test:${id}`],
    );
    return id;
  }

  const notification = async (id) =>
    (
      await db.query(
        'SELECT push_status, push_attempts, push_last_error, push_sent_at FROM user_notifications WHERE id = $1',
        [id],
      )
    ).rows[0];

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    jobs = app.get(JobsService);
    sender = app.get(PUSH_SENDER);
    originalSend = sender.send;
    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `oj_${RUN}`, `${adminId}@example.com`],
    );
  });

  afterEach(() => {
    sender.send = originalSend;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('push-send', () => {
    it('기기가 있으면 sent, 없으면 skipped', async () => {
      const withDevice = await createUser();
      const without = await createUser();
      await addDevice(withDevice);
      const sentId = await addNotification(withDevice);
      const skippedId = await addNotification(without);
      const calls = [];
      sender.send = async (message) => calls.push(message);

      const result = await jobs.runJob('push-send');
      expect(result.sent).toBeGreaterThanOrEqual(1);
      expect(calls.some((c) => c.title === '제목')).toBe(true);
      expect(await notification(sentId)).toMatchObject({
        push_status: 'sent',
        push_attempts: 1,
      });
      expect((await notification(sentId)).push_sent_at).not.toBeNull();
      expect((await notification(skippedId)).push_status).toBe('skipped');
    });

    it('실패하면 재시도하다가 5번째에 failed, 사용 못 하는 토큰은 기기를 끔', async () => {
      const userId = await createUser();
      const device = await addDevice(userId);
      const id = await addNotification(userId);
      sender.send = async () => {
        throw Object.assign(new Error('boom'), { invalidToken: true });
      };

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await db.query(
          'UPDATE push_devices SET is_active = true WHERE id = $1',
          [device.id],
        );
        await jobs.runJob('push-send');
        expect(await notification(id)).toMatchObject({
          push_status: 'pending',
          push_attempts: attempt,
          push_last_error: 'boom',
        });
      }
      await db.query('UPDATE push_devices SET is_active = true WHERE id = $1', [
        device.id,
      ]);
      await jobs.runJob('push-send');
      expect((await notification(id)).push_status).toBe('failed');
      const { rows } = await db.query(
        'SELECT is_active FROM push_devices WHERE id = $1',
        [device.id],
      );
      expect(rows[0].is_active).toBe(false);
    });

    it('기기 하나가 실패해도 다른 기기가 받으면 sent', async () => {
      const userId = await createUser();
      const bad = await addDevice(userId, `bad-${randomUUID()}`);
      await addDevice(userId, `good-${randomUUID()}`);
      const id = await addNotification(userId);
      sender.send = async ({ token }) => {
        if (token === bad.token) throw new Error('down');
      };
      await jobs.runJob('push-send');
      expect((await notification(id)).push_status).toBe('sent');
    });
  });

  describe('asset-uploads-cleanup', () => {
    it('7일 지난 미사용 티켓과 파일만 지우고, 사용된 티켓·최근 티켓은 남김', async () => {
      const storage = app.get(OBJECT_STORAGE);
      const insert = async (ageDays, consumed) => {
        const id = randomUUID();
        const key = `dev/assets/badges/${id}/v1.png`;
        await db.query(
          `INSERT INTO admin_asset_uploads
             (id, asset_kind, owner_id, version_no, object_key, mime_type,
              size_bytes, created_by_admin_id, created_at, uploaded_at, consumed_at)
           VALUES ($1, 'badge', $2, 1, $3, 'image/png', 10, $4,
                   now() - make_interval(days => $5),
                   now() - make_interval(days => $5),
                   CASE WHEN $6 THEN now() - make_interval(days => $5) END)`,
          [id, randomUUID(), key, adminId, ageDays, consumed],
        );
        storage.simulateUpload(key, { size: 10, contentType: 'image/png' });
        return { id, key };
      };
      const stale = await insert(10, false);
      const recent = await insert(1, false);
      const used = await insert(10, true);

      const result = await jobs.runJob('asset-uploads-cleanup');
      expect(result.deleted).toBeGreaterThanOrEqual(1);
      const exists = async (id) =>
        (
          await db.query('SELECT 1 FROM admin_asset_uploads WHERE id = $1', [
            id,
          ])
        ).rows.length === 1;
      expect(await exists(stale.id)).toBe(false);
      expect(storage.has(stale.key)).toBe(false);
      expect(await exists(recent.id)).toBe(true);
      expect(storage.has(recent.key)).toBe(true);
      expect(await exists(used.id)).toBe(true);
      expect(storage.has(used.key)).toBe(true);
    });
  });

  describe('withdrawal-complete', () => {
    async function createWithdrawal(status = 'processing') {
      const userId = await createUser();
      const requestId = randomUUID();
      await db.query(
        `INSERT INTO account_withdrawal_requests
           (id, user_id, status, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, now())`,
        [requestId, userId, status, adminId],
      );
      if (status === 'processing') {
        await db.query(
          "UPDATE users SET status = 'withdrawal_processing' WHERE id = $1",
          [userId],
        );
      }
      return { userId, requestId };
    }

    it('처리 중인 요청은 완료로 바꾸고 회원을 삭제함, 요청 기록은 남음', async () => {
      const { userId, requestId } = await createWithdrawal();
      const result = await jobs.runJob('withdrawal-complete');
      expect(result.completed).toBeGreaterThanOrEqual(1);
      const { rows: user } = await db.query(
        'SELECT 1 FROM users WHERE id = $1',
        [userId],
      );
      expect(user).toHaveLength(0);
      const { rows } = await db.query(
        'SELECT status, user_id, completed_at FROM account_withdrawal_requests WHERE id = $1',
        [requestId],
      );
      expect(rows[0]).toMatchObject({ status: 'completed', user_id: null });
      expect(rows[0].completed_at).not.toBeNull();
    });

    it('보류·접수 상태 요청은 건드리지 않음', async () => {
      const held = await createWithdrawal('on_hold');
      await jobs.runJob('withdrawal-complete');
      const { rows } = await db.query('SELECT 1 FROM users WHERE id = $1', [
        held.userId,
      ]);
      expect(rows).toHaveLength(1);
    });
  });
});
