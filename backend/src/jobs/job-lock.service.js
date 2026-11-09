import { Dependencies, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/**
 * 작업 이름 단위 배타 실행 (팀 문서 parts/backend §4.8)
 * pg_try_advisory_lock(hashtext(name))을 잡은 인스턴스만 실행하고, 못 잡으면 건너뜀
 * 세션 락이라 전용 연결 하나를 작업이 끝날 때까지 들고 있음(작업 자체는 풀의 다른 연결 사용)
 */
@Injectable()
@Dependencies(DatabaseService)
export class JobLock {
  constructor(database) {
    this.database = database;
  }

  /** 락을 잡으면 fn 결과를, 못 잡으면 { skipped: 'locked' }를 돌려줌 */
  async runExclusive(name, fn) {
    const client = await this.database.pool.connect();
    try {
      const { rows } = await client.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [`job:${name}`],
      );
      if (!rows[0].acquired) return { skipped: 'locked' };
      try {
        return await fn();
      } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          `job:${name}`,
        ]);
      }
    } finally {
      client.release();
    }
  }
}
