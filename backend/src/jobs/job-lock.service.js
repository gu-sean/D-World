import { Dependencies, Injectable, Logger } from '@nestjs/common';
import pg from 'pg';
import { DatabaseService } from '../database/database.service.js';

/**
 * 작업 이름 단위 배타 실행 (팀 문서 parts/backend §4.8)
 * pg_try_advisory_lock(hashtext(name))을 잡은 인스턴스만 실행하고, 못 잡으면 건너뜀
 *
 * 세션 락이라 락을 잡은 연결을 작업이 끝날 때까지 유지해야 한다. 작업마다 풀 연결을 하나씩 쥐면
 * 정기 작업이 몰릴 때 일반 요청이 쓸 연결이 바닥나므로, 락 전용 연결 1개를 풀 밖에 두고 모든 작업이
 * 그 연결을 함께 쓴다(작업 자체의 쿼리는 기존 풀을 그대로 쓴다).
 * 같은 연결로는 같은 락이 겹쳐 잡히므로, 이 서버 안에서 이미 도는 작업은 `running`으로 먼저 막는다.
 * 연결이 끊기면 다음 작업 때 새로 연결한다(끊긴 동안 잡았던 락은 DB가 풀어 준다).
 */
@Injectable()
@Dependencies(DatabaseService)
export class JobLock {
  logger = new Logger(JobLock.name);
  client = null;
  connecting = null;
  running = new Set();
  queue = Promise.resolve(); // 락 전용 연결의 쿼리를 한 번에 하나씩 보내기 위한 줄

  constructor(database) {
    this.database = database;
  }

  /** 락 전용 연결을 돌려줌(없거나 끊겼으면 새로 만듦) */
  async lockClient() {
    if (this.client) return this.client;
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  async connect() {
    const { connectionString, ssl, connectionTimeoutMillis } =
      this.database.pool.options;
    const client = new pg.Client({
      connectionString,
      ssl,
      connectionTimeoutMillis,
      application_name: 'd-world-job-lock',
    });
    // 연결이 끊겨도 서버가 죽지 않게 한다(오류 처리기가 없으면 프로세스가 종료됨)
    client.on('error', (error) => {
      this.logger.error(`락 전용 연결 오류: ${error.message}`);
      if (this.client === client) this.client = null;
    });
    await client.connect();
    this.client = client;
    return client;
  }

  /**
   * 락 전용 연결에 쿼리를 한 번에 하나씩 보낸다.
   * pg는 실행 중인 연결에 쿼리를 또 보내면 경고하고(pg 9에서 제거 예정), 작업이 겹칠 때 그런 일이 생긴다.
   */
  exec(client, text, values) {
    const run = this.queue.then(() => client.query(text, values));
    this.queue = run.catch(() => {});
    return run;
  }

  /** 락을 잡으면 fn 결과를, 못 잡으면 { skipped: 'locked' }를 돌려줌 */
  async runExclusive(name, fn) {
    // 같은 연결에서는 같은 락을 다시 잡을 수 있으므로, 이 서버에서 이미 도는 작업은 먼저 막는다
    if (this.running.has(name)) return { skipped: 'locked' };
    this.running.add(name);
    try {
      const client = await this.lockClient();
      const key = `job:${name}`;
      const { rows } = await this.exec(
        client,
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [key],
      );
      if (!rows[0].acquired) return { skipped: 'locked' };
      try {
        return await fn();
      } finally {
        await this.exec(client, 'SELECT pg_advisory_unlock(hashtext($1))', [
          key,
        ]).catch((error) =>
          this.logger.warn(`락 해제 실패(${name}): ${error.message}`),
        );
      }
    } finally {
      this.running.delete(name);
    }
  }

  async onApplicationShutdown() {
    const client = this.client;
    this.client = null;
    if (client) await client.end().catch(() => {});
  }
}
