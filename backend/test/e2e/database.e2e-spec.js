import { validateEnv } from '../../src/config/env.validation.js';
import {
  DatabaseService,
  isRetryableError,
} from '../../src/database/database.service.js';
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)('DatabaseService (PostgreSQL)', () => {
  let db;
  beforeAll(() => {
    const env = validateEnv({
      DATABASE_URL: databaseUrl,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
    });
    const config = {
      get: (key) => env[key],
    };
    db = new DatabaseService(config);
  });
  afterAll(async () => {
    await db.onApplicationShutdown();
  });
  it('ping 성공', async () => {
    await expect(db.ping()).resolves.toBeUndefined();
  });
  it('date 컬럼은 시간대와 무관하게 YYYY-MM-DD 문자열', async () => {
    const { rows } = await db.query(`SELECT DATE '2026-11-01' AS d`);
    expect(rows[0].d).toBe('2026-11-01');
  });
  it('세션 타임아웃·application_name 적용', async () => {
    const { rows } =
      await db.query(`SELECT current_setting('application_name') AS name,
              current_setting('statement_timeout') AS st,
              current_setting('idle_in_transaction_session_timeout') AS it`);
    expect(rows[0]).toEqual({
      name: 'd-world-backend',
      st: '30s',
      it: '1min',
    });
  });
  it('성공 시 커밋', async () => {
    await db.query('DROP TABLE IF EXISTS tx_probe');
    await db.query('CREATE TABLE tx_probe (v int)');
    try {
      await db.withTransaction(async (tx) => {
        await tx.query('INSERT INTO tx_probe VALUES (1)');
      });
      const { rows } = await db.query('SELECT count(*) AS c FROM tx_probe');
      expect(rows[0].c).toBe('1');
    } finally {
      await db.query('DROP TABLE tx_probe');
    }
  });
  it('오류 시 롤백 후 오류 재던짐', async () => {
    await db.query('DROP TABLE IF EXISTS tx_probe');
    await db.query('CREATE TABLE tx_probe (v int)');
    try {
      await expect(
        db.withTransaction(async (tx) => {
          await tx.query('INSERT INTO tx_probe VALUES (1)');
          throw new Error('중간 실패');
        }),
      ).rejects.toThrow('중간 실패');
      const { rows } = await db.query('SELECT count(*) AS c FROM tx_probe');
      expect(rows[0].c).toBe('0');
    } finally {
      await db.query('DROP TABLE tx_probe');
    }
  });
  it('직렬화 실패·교착은 제한 횟수만 재시도', async () => {
    let calls = 0;
    const result = await db.withTransaction(async () => {
      calls++;
      if (calls < 3)
        throw Object.assign(new Error('retry'), {
          code: '40001',
        });
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    calls = 0;
    await expect(
      db.withTransaction(
        async () => {
          calls++;
          throw Object.assign(new Error('retry'), {
            code: '40P01',
          });
        },
        {
          retries: 1,
        },
      ),
    ).rejects.toThrow('retry');
    expect(calls).toBe(2);
  });
  it('재시도 대상이 아닌 오류는 1회만 실행', async () => {
    let calls = 0;
    await expect(
      db.withTransaction(async () => {
        calls++;
        throw Object.assign(new Error('unique'), {
          code: '23505',
        });
      }),
    ).rejects.toThrow('unique');
    expect(calls).toBe(1);
    expect(
      isRetryableError({
        code: '23505',
      }),
    ).toBe(false);
  });
  it('트랜잭션 안에서 같은 연결 사용', async () => {
    const pids = await db.withTransaction(async (tx) => {
      const a = await tx.query('SELECT pg_backend_pid() AS pid');
      const b = await tx.query('SELECT pg_backend_pid() AS pid');
      return [a.rows[0].pid, b.rows[0].pid];
    });
    expect(pids[0]).toBe(pids[1]);
  });
  it('마이그레이션이 적용된 스키마 조회 가능', async () => {
    const { rows } = await db.query(
      `SELECT count(*) AS n FROM information_schema.tables WHERE table_name = 'point_transactions'`,
    );
    expect(rows[0].n).toBe('1');
  });
});
