import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProposalsService } from '../ai-proposals/proposals.service.js';
import { DatabaseService } from '../database/database.service.js';
import { MediaService } from '../media/media.service.js';
import { MissionsService } from '../missions/missions.service.js';
import { ScoringService } from '../challenges/scoring.service.js';
import { RewardPayoutService } from '../challenges/reward-payout.service.js';
import { StreakService } from '../streak/streak.service.js';
import { AiDispatchService } from '../verification/ai/ai-dispatch.service.js';

const SEC = 1000;
const MIN = 60 * SEC;

/**
 * 주기 작업 실행기 (3-C-5)
 * - JOBS_ENABLED=true인 프로세스만 타이머를 돌린다. 작업은 모두 멱등이고 행 잠금·SKIP LOCKED로
 *   동시 실행에도 안전하나 중복 방지를 위해 한 인스턴스만 켜는 것을 권장
 * - 같은 작업은 겹쳐 실행하지 않음(이전 실행 종료 후 다음), 오류는 기록 후 다음 주기에 재시도
 * - runJob(name)으로 즉시 한 번 실행할 수 있다(테스트·운영 점검용).
 */
@Injectable()
@Dependencies(
  ConfigService,
  DatabaseService,
  MediaService,
  MissionsService,
  ProposalsService,
  AiDispatchService,
  StreakService,
  ScoringService,
  RewardPayoutService,
)
export class JobsService {
  logger = new Logger(JobsService.name);
  timers = [];
  running = new Set();

  constructor(
    config,
    database,
    media,
    missions,
    proposals,
    aiDispatch,
    streak,
    challengeScoring,
    payout,
  ) {
    this.config = config;
    this.database = database;
    this.jobs = [
      {
        name: 'ai-dispatch',
        everyMs: 30 * SEC,
        run: () => aiDispatch.dispatchPending(),
      },
      {
        name: 'media-reconcile-pending',
        everyMs: MIN,
        run: () => media.reconcileExpiredPending(),
      },
      {
        name: 'media-finish-deletions',
        everyMs: 5 * MIN,
        run: () => media.finishDeletions(),
      },
      {
        name: 'media-purge-withdrawn',
        everyMs: 10 * MIN,
        run: () => this.purgeWithdrawnMedia(media),
      },
      {
        name: 'missions-fail-overdue',
        everyMs: 5 * MIN,
        run: () => missions.failOverdue(),
      },
      {
        name: 'streak-settle',
        everyMs: 5 * MIN,
        run: () => streak.settleDays(),
      },
      {
        name: 'challenge-days-settle',
        everyMs: 5 * MIN,
        run: () => challengeScoring.settleDays(),
      },
      {
        name: 'challenge-payments',
        everyMs: 5 * MIN,
        run: () => payout.payDue(),
      },
      {
        name: 'proposals-expire',
        everyMs: 60 * MIN,
        run: () => proposals.expireStale(),
      },
    ];
  }

  /** 탈퇴 처리 중인 사용자의 R2 파일 삭제, 실패한 파일은 남겨 두고 다음 주기에 이어서 처리 */
  async purgeWithdrawnMedia(media, { limit = 50 } = {}) {
    const { rows } = await this.database.query(
      `SELECT u.id FROM users u
        WHERE u.status = 'withdrawal_processing'
          AND EXISTS (SELECT 1 FROM media_files f WHERE f.user_id = u.id AND f.upload_status <> 'deleted')
        ORDER BY u.updated_at LIMIT $1`,
      [limit],
    );
    let users = 0;
    for (const { id } of rows) {
      await media.deleteAllForUser(id);
      users += 1;
    }
    return { users };
  }

  names() {
    return this.jobs.map((job) => job.name);
  }

  /** 한 번 실행, 이미 실행 중이면 건너뜀. 오류는 던지지 않고 { error }로 돌려줌 */
  async runJob(name) {
    const job = this.jobs.find((candidate) => candidate.name === name);
    if (!job) throw new RangeError(`알 수 없는 작업: ${name}`);
    if (this.running.has(name)) return { skipped: 'running' };
    this.running.add(name);
    try {
      const result = await job.run();
      const worked =
        result &&
        Object.values(result).some((v) => typeof v === 'number' && v > 0);
      if (worked) this.logger.log(`${name}: ${JSON.stringify(result)}`);
      return result ?? {};
    } catch (err) {
      this.logger.error(`${name} 실패: ${err.message}`, err.stack);
      return { error: err.message };
    } finally {
      this.running.delete(name);
    }
  }

  onApplicationBootstrap() {
    if (!this.config.get('JOBS_ENABLED')) return;
    for (const job of this.jobs) {
      // 시작 직후 한꺼번에 몰리지 않도록 첫 실행에 약간의 어긋남을 둠
      const jitter = Math.floor(
        Math.random() * Math.min(job.everyMs, 10 * SEC),
      );
      const start = setTimeout(() => {
        this.runJob(job.name);
        const timer = setInterval(() => this.runJob(job.name), job.everyMs);
        timer.unref();
        this.timers.push(timer);
      }, jitter);
      start.unref();
      this.timers.push(start);
    }
    this.logger.log(`주기 작업 시작: ${this.names().join(', ')}`);
  }

  onModuleDestroy() {
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers = [];
  }
}
