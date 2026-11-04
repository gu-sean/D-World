import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

/**
 * Queryable: Pool·트랜잭션 클라이언트 공통 형태, 서비스 메서드는 query(text, values)를 가진 객체로 받음
 * withTransaction 옵션: { retries = 2, isolation = 'READ COMMITTED' }
 *   isolation은 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE', 잠금은 SELECT ... FOR UPDATE로 명시
 */
const ISOLATION_LEVELS = new Set([
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
]);
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']);
const CONNECTION_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 30_000;

// date를 JS Date로 변환하면 서버 시간대에 따라 KST 날짜가 밀림, 문자열 유지
const PG_DATE_OID = 1082;
pg.types.setTypeParser(PG_DATE_OID, (value) => value);

export function isRetryableError(err) {
  const code = err?.code;
  return typeof code === 'string' && RETRYABLE_SQLSTATES.has(code);
}

@Injectable()
@Dependencies(ConfigService)
export class DatabaseService {
  logger = new Logger(DatabaseService.name);

  constructor(config) {
    this.pool = new pg.Pool({
      connectionString: config.get('DATABASE_URL'),
      max: config.get('DATABASE_POOL_MAX'),
      ssl: config.get('DATABASE_SSL')
        ? { rejectUnauthorized: true }
        : undefined,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      application_name: 'd-world-backend',
      statement_timeout: config.get('DATABASE_STATEMENT_TIMEOUT_MS'),
      idle_in_transaction_session_timeout: config.get(
        'DATABASE_IDLE_TX_TIMEOUT_MS',
      ),
    });
    this.pool.on('error', (err) =>
      this.logger.error(`유휴 연결 오류: ${err.message}`),
    );
  }

  query(text, values) {
    return this.pool.query(text, values);
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }

  /**
   * BEGIN → fn → COMMIT, 오류 시 ROLLBACK 후 재던짐
   * 40001(직렬화 실패)·40P01(교착)만 재시도, fn은 재실행에 안전해야 함
   */
  async withTransaction(fn, options = {}) {
    const retries = options.retries ?? 2;
    const isolation = options.isolation ?? 'READ COMMITTED';
    // isolation은 SQL에 직접 들어가므로 허용 목록으로 제한
    if (!ISOLATION_LEVELS.has(isolation)) {
      throw new RangeError(`지원하지 않는 격리 수준: ${isolation}`);
    }

    for (let attempt = 0; ; attempt++) {
      const client = await this.pool.connect();
      let destroy = false;
      try {
        await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          // 롤백 실패 연결은 풀에 반환하지 않고 폐기
          destroy = true;
          this.logger.error(`ROLLBACK 실패: ${rollbackErr.message}`);
        }
        if (isRetryableError(err) && attempt < retries) {
          this.logger.warn(`트랜잭션 재시도 ${attempt + 1}/${retries}`);
          await new Promise((resolve) =>
            setTimeout(resolve, 25 * 2 ** attempt),
          );
          continue;
        }
        throw err;
      } finally {
        client.release(destroy);
      }
    }
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
