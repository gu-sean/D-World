import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProposalsService } from '../ai-proposals/proposals.service.js';
import { DatabaseService } from '../database/database.service.js';
import { JobLock } from './job-lock.service.js';
import { MediaService } from '../media/media.service.js';
import { MissionsService } from '../missions/missions.service.js';
import { ScoringService } from '../challenges/scoring.service.js';
import { RewardPayoutService } from '../challenges/reward-payout.service.js';
import { StreakService } from '../streak/streak.service.js';
import { OBJECT_STORAGE } from '../media/storage/object-storage.js';
import { AchievementsService } from '../achievements/achievements.service.js';
import { PushDeliveryService } from '../notices/push-delivery.service.js';
import { NoticeDeliveryService } from '../notices/notice-delivery.service.js';
import { AiReportsService } from '../ai-analysis/ai-reports.service.js';
import { PlanAdjustmentRunsService } from '../ai-analysis/plan-adjustment-runs.service.js';
import { AiDispatchService } from '../verification/ai/ai-dispatch.service.js';
import { WeatherCollectorService } from '../recommendations/weather-collector.service.js';
import { WeatherStoreService } from '../recommendations/weather-store.service.js';

const SEC = 1000;
const MIN = 60 * SEC;

/**
 * 정기 작업 실행기
 * - JOBS_DISABLED가 아닌 프로세스만 타이머를 돌린다. 작업은 모두 멱등이고 행 잠금·SKIP LOCKED로
 *   안전하며, JobLock(advisory lock)이 인스턴스 간 같은 작업의 동시 실행을 막는다
 * - 같은 작업은 프로세스 안에서 겹쳐 실행하지 않음(이전 실행 종료 후 다음), 오류는 기록 후 다음 주기에 재시도
 * - runJob(name)으로 즉시 한 번 실행할 수 있다(테스트, 개발용 POST /internal/v1/dev/jobs/{jobName}).
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
  NoticeDeliveryService,
  PushDeliveryService,
  AchievementsService,
  OBJECT_STORAGE,
  JobLock,
  AiReportsService,
  PlanAdjustmentRunsService,
  WeatherCollectorService,
  WeatherStoreService,
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
    noticeDelivery,
    pushDelivery,
    achievements,
    storage,
    lock,
    aiReports,
    planAdjustments,
    weatherCollector,
    weatherStore,
  ) {
    this.storage = storage;
    this.config = config;
    this.lock = lock;
    this.database = database;
    this.jobs = [
      {
        name: 'ai-dispatch',
        everyMs: 30 * SEC,
        run: () => aiDispatch.dispatchPending(),
      },
      {
        name: 'ai-report-dispatch',
        everyMs: 10 * MIN,
        run: () => aiReports.dispatchDue(),
      },
      {
        name: 'plan-adjust-dispatch',
        everyMs: 10 * MIN,
        run: () => planAdjustments.dispatchDue(),
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
        name: 'notices-deliver',
        everyMs: 30 * SEC,
        run: () => noticeDelivery.deliverDue(),
      },
      {
        name: 'push-send',
        everyMs: 30 * SEC,
        run: () => pushDelivery.sendPending(),
      },
      {
        name: 'achievement-backfill',
        everyMs: MIN,
        run: () => achievements.processBackfillRuns(),
      },
      {
        name: 'withdrawal-complete',
        everyMs: 10 * MIN,
        run: () => this.completeWithdrawals(),
      },
      {
        name: 'asset-uploads-cleanup',
        everyMs: 60 * MIN,
        run: () => this.cleanupAssetUploads(),
      },
      {
        // 최근 요청된 격자의 날씨를 매시간 한 번씩 저장(10분마다 확인, 이미 수집한 격자는 건너뜀)
        name: 'weather-collect',
        everyMs: 10 * MIN,
        run: () => weatherCollector.collect(),
      },
      {
        name: 'weather-purge',
        everyMs: 60 * MIN,
        run: () => weatherStore.purge(),
      },
      {
        name: 'proposals-expire',
        everyMs: 60 * MIN,
        run: () => proposals.expireStale(),
      },
      {
        name: 'idempotency-cleanup',
        everyMs: 60 * MIN,
        run: () => this.cleanupIdempotencyKeys(),
      },
    ];
  }

  /**
   * 보관 기간(IDEMPOTENCY_RETENTION_HOURS)이 지난 멱등 키 삭제(앱·관리자 테이블 모두)
   * 한 번에 limit건씩 지워 긴 잠금을 피하고, 남은 건은 다음 주기에 이어서 처리
   */
  async cleanupIdempotencyKeys({ limit = 1000 } = {}) {
    const hours = this.config.get('IDEMPOTENCY_RETENTION_HOURS');
    const deleted = {};
    for (const table of ['user_idempotency_keys', 'admin_idempotency_keys']) {
      const { rowCount } = await this.database.query(
        `DELETE FROM ${table}
          WHERE id IN (
            SELECT id FROM ${table}
             WHERE created_at < now() - make_interval(hours => $1)
             ORDER BY created_at LIMIT $2)`,
        [hours, limit],
      );
      deleted[table === 'user_idempotency_keys' ? 'user' : 'admin'] = rowCount;
    }
    return deleted;
  }

  /**
   * 관리자 이미지 업로드 티켓 중 7일이 지나도록 업적·펫 종류에 쓰이지 않은 것과 저장소의 파일 삭제
   * 파일 삭제가 실패한 티켓은 남겨 두고 다음 주기에 다시 시도
   */
  async cleanupAssetUploads({ limit = 100 } = {}) {
    const { rows } = await this.database.query(
      `SELECT id, object_key FROM admin_asset_uploads
        WHERE consumed_at IS NULL AND created_at < now() - interval '7 days'
        ORDER BY created_at LIMIT $1`,
      [limit],
    );
    let deleted = 0;
    for (const { id, object_key: key } of rows) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        this.logger.warn(`업로드 파일 삭제 실패(${key}): ${error.message}`);
        continue;
      }
      const { rowCount } = await this.database.query(
        'DELETE FROM admin_asset_uploads WHERE id = $1 AND consumed_at IS NULL',
        [id],
      );
      deleted += rowCount;
    }
    return { deleted };
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

  /**
   * 처리 중인 탈퇴 요청 마무리: 인증 파일(R2)이 모두 지워진 회원만 대상
   * 요청을 completed로 바꾸고 회원을 삭제(연쇄 삭제, 요청의 user_id는 NULL로 남음)
   * 파일 삭제(media-purge-withdrawn)가 끝나기 전에는 건너뛰어 다음 주기에 다시 봄
   */
  async completeWithdrawals({ limit = 20 } = {}) {
    const { rows } = await this.database.query(
      `SELECT w.id, w.user_id
         FROM account_withdrawal_requests w
         JOIN users u ON u.id = w.user_id
        WHERE w.status = 'processing' AND u.status = 'withdrawal_processing'
          AND NOT EXISTS (SELECT 1 FROM media_files f
                           WHERE f.user_id = u.id AND f.upload_status <> 'deleted')
        ORDER BY w.requested_at LIMIT $1`,
      [limit],
    );
    let completed = 0;
    for (const { id, user_id: userId } of rows) {
      const done = await this.database.withTransaction(async (tx) => {
        const { rows: locked } = await tx.query(
          `SELECT 1 FROM account_withdrawal_requests w
             JOIN users u ON u.id = w.user_id
            WHERE w.id = $1 AND w.status = 'processing'
              AND u.status = 'withdrawal_processing'
              AND NOT EXISTS (SELECT 1 FROM media_files f
                               WHERE f.user_id = u.id AND f.upload_status <> 'deleted')
              FOR UPDATE OF w, u SKIP LOCKED`,
          [id],
        );
        if (locked.length === 0) return false;
        await tx.query(
          `UPDATE account_withdrawal_requests
              SET status = 'completed', completed_at = now() WHERE id = $1`,
          [id],
        );
        await tx.query('DELETE FROM users WHERE id = $1', [userId]);
        return true;
      });
      if (done) completed += 1;
    }
    return { completed };
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
      const result = await this.lock.runExclusive(name, job.run);
      const worked =
        result &&
        Object.values(result).some((v) => typeof v === 'number' && v > 0);
      if (worked) this.logger.log(`${name}: ${JSON.stringify(result)}`);
      return result ?? {};
    } catch (error) {
      this.logger.error(`${name} 실패: ${error.message}`, error.stack);
      return { error: error.message };
    } finally {
      this.running.delete(name);
    }
  }

  onApplicationBootstrap() {
    if (this.config.get('JOBS_DISABLED')) return;
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
    this.logger.log(`정기 작업 시작: ${this.names().join(', ')}`);
  }

  onModuleDestroy() {
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers = [];
  }
}
