import { newId } from '../../common/ids.js';
import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception.js';
import { addDays, kstDayStart } from '../../common/time/kst.js';
import { DatabaseService } from '../../database/database.service.js';
import { MediaService } from '../../media/media.service.js';
import {
  APPEAL_WINDOW,
  MAX_SUBMISSIONS,
  OPEN_RECORD_STATUSES,
  STARTABLE_MISSION_STATUSES,
} from './records.constants.js';
import { conflict, unprocessable } from '../../common/errors/http-errors.js';

const num = (value) => Number(value);

const POLL_AFTER_MS = 2000;

/** 07 VerificationMetrics: 모든 키를 항상 두고 해당 없으면 null */
const EMPTY_METRICS = {
  exerciseCode: null,
  repCount: null,
  validRepCount: null,
  invalidRepCount: null,
  holdSeconds: null,
  accuracy: null,
  durationSeconds: null,
  personDetected: null,
  distanceMeters: null,
  activeSeconds: null,
  avgPaceSecondsPerKm: null,
  steps: null,
  avgCadenceSpm: null,
  validPointRatio: null,
  mockLocationDetected: null,
  mediaSha256: null,
  flags: [],
  issues: [],
};

const missionNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'mission_not_found',
    '미션을 찾을 수 없음',
  );
const recordNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'record_not_found',
    '수행 회차를 찾을 수 없음',
  );

const RECORD_SELECT = `
  SELECT r.id, r.mission_id, r.attempt_no, r.submission_no, r.status, r.evidence_kind,
         r.started_at, r.submitted_at, r.completed_at, r.metrics,
         vr.id AS result_id, vr.source AS result_source, vr.decision AS result_decision,
         vr.reason AS result_reason, vr.decided_at AS result_decided_at,
         vr.notified_at AS result_notified_at,
         vr.result_no AS result_no, vr.confidence AS result_confidence,
         vr.engine_version AS result_engine_version, vr.metrics AS result_metrics,
         m.status AS mission_status, m.exercise_code AS mission_exercise_code,
         vr.notified_at + interval '${APPEAL_WINDOW}' AS appeal_deadline,
         a.status AS appeal_status,
         (vr.decision = 'rejected' AND vr.source = 'ai' AND vr.notified_at IS NOT NULL
            AND now() <= vr.notified_at + interval '${APPEAL_WINDOW}' AND a.id IS NULL) AS can_appeal
    FROM mission_records r
    JOIN missions m ON m.id = r.mission_id
    LEFT JOIN verification_results vr ON vr.record_id = r.id AND vr.is_current
    LEFT JOIN verification_appeals a ON a.record_id = r.id
     AND (a.original_result_id = vr.id OR a.resolution_result_id = vr.id)`;

/**
 * 수행 회차: 시작, 제출, 포기, 조회
 * 판정·보상 반영은 DecisionService. 여기서는 미션 상태 scheduled → in_progress → submitted까지
 * 잠금 순서: 미션 → 회차 → 파일 (미디어·판정 반영과 같은 순서)
 */
@Injectable()
@Dependencies(DatabaseService, MediaService)
export class RecordsService {
  logger = new Logger(RecordsService.name);

  constructor(database, media) {
    this.database = database;
    this.media = media;
  }

  /** 마감 시각: due_at이 없으면 예정일 다음 날 00:00(KST) */
  deadlineOf(mission) {
    return mission.due_at
      ? new Date(mission.due_at)
      : kstDayStart(addDays(mission.scheduled_date, 1));
  }

  /** 소유자 확인과 함께 미션 행 잠금, 삭제된 미션은 404 */
  async lockMission(tx, userId, missionId) {
    const { rows } = await tx.query(
      `SELECT id, status, verification_method, scheduled_date, due_at, deleted_at
         FROM missions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [missionId, userId],
    );
    if (!rows[0] || rows[0].deleted_at) throw missionNotFound();
    return rows[0];
  }

  /** 미션 → 회차 순서로 잠그고 둘 다 돌려줌, 소유자가 아니면 404 */
  async lockChain(tx, userId, recordId) {
    const { rows: probe } = await tx.query(
      'SELECT mission_id FROM mission_records WHERE id = $1 AND user_id = $2',
      [recordId, userId],
    );
    if (!probe[0]) throw recordNotFound();
    const { rows: missions } = await tx.query(
      `SELECT id, status, verification_method, scheduled_date, due_at, deleted_at
         FROM missions WHERE id = $1 FOR UPDATE`,
      [probe[0].mission_id],
    );
    const { rows: records } = await tx.query(
      `SELECT id, mission_id, status, submission_no, metrics
         FROM mission_records WHERE id = $1 FOR UPDATE`,
      [recordId],
    );
    return { mission: missions[0], record: records[0] };
  }

  toView(row, files = []) {
    const decided = Boolean(row.result_id);
    return {
      id: row.id,
      missionId: row.mission_id,
      attemptNo: row.attempt_no,
      submissionNo: row.submission_no,
      status: row.status,
      evidenceKind: row.evidence_kind,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      metrics: row.metrics,
      files: files.map((f) => ({
        id: f.id,
        mediaKind: f.media_kind,
        status: f.upload_status,
      })),
      // 모바일 클라이언트(08 MissionRecord) 키, 위 키와 함께 내려감
      media: files.map((f) => ({
        mediaId: f.id,
        mediaKind: f.media_kind,
        uploadStatus: f.upload_status,
        sizeBytes: Number(f.actual_size_bytes ?? f.expected_size_bytes),
      })),
      currentResult: decided ? this.toCurrentResult(row) : null,
      mission: {
        id: row.mission_id,
        status: row.mission_status,
        remainingSubmissions: Math.max(
          0,
          MAX_SUBMISSIONS - Number(row.submission_count ?? 0),
        ),
      },
      rewards: null,
      canAppeal: Boolean(row.can_appeal),
      pollAfterMs:
        !decided && ['recording', 'uploading', 'submitted'].includes(row.status)
          ? POLL_AFTER_MS
          : null,
      // 안내 전(검수 대기) 판정의 사유는 보여 주지 않음
      result: decided
        ? {
            decision: row.result_decision,
            source: row.result_source,
            reason: row.result_notified_at ? row.result_reason : null,
            decidedAt: row.result_decided_at,
            notified: Boolean(row.result_notified_at),
          }
        : null,
      appeal:
        decided &&
        ((row.result_decision === 'rejected' && row.result_source === 'ai') ||
          row.appeal_status)
          ? {
              status: row.appeal_status ?? null,
              canFile: row.can_appeal,
              deadline: row.appeal_deadline,
            }
          : null,
    };
  }

  /** 회차들의 파일 상태를 한 번에 조회해 회차별로 묶음 */
  async loadFiles(db, recordIds) {
    if (recordIds.length === 0) return new Map();
    const { rows } = await db.query(
      `SELECT id, record_id, media_kind, upload_status, expected_size_bytes,
              actual_size_bytes FROM media_files
        WHERE record_id = ANY($1::short_id[]) AND upload_status <> 'deleted'
        ORDER BY created_at, id`,
      [recordIds],
    );
    const byRecord = new Map();
    for (const row of rows) {
      if (!byRecord.has(row.record_id)) byRecord.set(row.record_id, []);
      byRecord.get(row.record_id).push(row);
    }
    return byRecord;
  }

  async viewRecord(db, userId, recordId) {
    const { rows } = await db.query(
      `${RECORD_SELECT} WHERE r.id = $1 AND r.user_id = $2`,
      [recordId, userId],
    );
    if (!rows[0]) throw recordNotFound();
    const files = await this.loadFiles(db, [recordId]);
    const view = this.toView(rows[0], files.get(recordId));
    await this.attachMissionInfo(db, userId, [{ row: rows[0], view }]);
    return view;
  }

  /** 07 VerificationResult: 안내 전에는 사유를 숨기고, metrics는 모든 키를 두고 없으면 null */
  toCurrentResult(row) {
    return {
      id: row.result_id,
      resultNo: row.result_no,
      source: row.result_source,
      decision: row.result_decision,
      confidence:
        row.result_confidence === null ? null : num(row.result_confidence),
      reason: row.result_notified_at ? row.result_reason : null,
      engineVersion: row.result_engine_version,
      metrics: { ...EMPTY_METRICS, ...(row.result_metrics ?? {}) },
      decidedAt: row.result_decided_at,
    };
  }

  /**
   * 남은 제출 수와 승인 회차의 지급 보상을 채움
   * - 보상: 승인 때 저장한 `metrics.rewards` 우선, 없으면 지급 기록·원장에서 복원 (grantedRewards)
   */
  async attachMissionInfo(db, userId, items) {
    const missionIds = [...new Set(items.map(({ row }) => row.mission_id))];
    const { rows: counts } = await db.query(
      `SELECT mission_id, count(*)::int AS n FROM mission_records
        WHERE mission_id = ANY($1::short_id[]) AND submission_no IS NOT NULL
        GROUP BY mission_id`,
      [missionIds],
    );
    const submitted = new Map(counts.map((c) => [c.mission_id, c.n]));
    for (const { row, view } of items) {
      view.mission.remainingSubmissions = Math.max(
        0,
        MAX_SUBMISSIONS - (submitted.get(row.mission_id) ?? 0),
      );
      if (row.result_decision === 'approved') {
        // 승인 때 저장한 보상 요약을 우선, 없으면(이전 데이터) 지급 기록에서 만든다
        view.rewards =
          row.metrics?.rewards ??
          (await this.grantedRewards(db, userId, row.mission_id));
      }
    }
  }

  /**
   * 승인 때 저장한 보상 요약(metrics.rewards)이 없는 이전 기록의 보상을 지급 기록·원장에서 복원한다.
   * 레벨업·펫 진화·새 배지는 승인과 같은 트랜잭션 시각(experience_transactions.occurred_at)을 기준으로 찾는다.
   * streakDays는 그 시점 값을 알 수 없어 현재 값을 쓴다.
   */
  async grantedRewards(db, userId, missionId) {
    const [points, xp, streak] = await Promise.all([
      db.query(
        `SELECT original_points, paid_points, awarded_at FROM mission_point_awards
          WHERE mission_id = $1 AND user_id = $2 AND status = 'active'`,
        [missionId, userId],
      ),
      db.query(
        `SELECT id, recipient_pet_id, base_user_xp, base_pet_xp, bonus_pet_xp, first_awarded_at
           FROM experience_awards
          WHERE user_id = $1 AND source_type = 'mission' AND source_id = $2
            AND status = 'active'`,
        [userId, missionId],
      ),
      db.query(
        'SELECT current_success_days FROM streak_states WHERE user_id = $1',
        [userId],
      ),
    ]);
    if (!points.rows[0] && !xp.rows[0]) return null;
    const point = points.rows[0];
    const award = xp.rows[0];
    const history = await this.rewardHistory(db, userId, point, award);
    return {
      points: point ? point.paid_points : 0,
      pointsCapped: point ? point.paid_points < point.original_points : false,
      userXp: award ? award.base_user_xp : 0,
      petXp: award ? award.base_pet_xp + award.bonus_pet_xp : 0,
      petId: award?.recipient_pet_id ?? null,
      levelUp: history.levelUp,
      newLevelNo: history.newLevelNo,
      petEvolved: history.petEvolved,
      streakDays: streak.rows[0]?.current_success_days ?? 0,
      newBadges: history.newBadges,
    };
  }

  /** 지급 당시의 레벨업·펫 진화·새 배지 (grantedRewards 참고) */
  async rewardHistory(db, userId, point, award) {
    const none = {
      levelUp: false,
      newLevelNo: null,
      petEvolved: false,
      newBadges: [],
    };
    let userTx;
    let petTx;
    if (award) {
      const { rows } = await db.query(
        `SELECT recipient_kind, xp_delta, balance_after, occurred_at
           FROM experience_transactions
          WHERE experience_award_id = $1 AND kind = 'award'`,
        [award.id],
      );
      userTx = rows.find((row) => row.recipient_kind === 'user');
      petTx = rows.find((row) => row.recipient_kind === 'pet');
    }
    // 승인과 같은 트랜잭션에서 지급된 것들의 시각(now())이라 서로 같다
    const approvedAt =
      userTx?.occurred_at ??
      petTx?.occurred_at ??
      award?.first_awarded_at ??
      point?.awarded_at;
    if (!approvedAt) return none;

    // 서로 독립이라 병렬 조회
    const [level, evolved, badges] = await Promise.all([
      userTx ? this.levelChange(db, userId, userTx) : null,
      award?.recipient_pet_id && petTx
        ? this.petEvolvedBy(db, award.recipient_pet_id, petTx)
        : false,
      db.query(
        `SELECT ua.achievement_id, v.title, v.rarity
           FROM user_achievements ua
           JOIN achievement_versions v ON v.id = ua.achievement_version_id
          WHERE ua.user_id = $1 AND ua.status = 'active' AND ua.awarded_at = $2`,
        [userId, approvedAt],
      ),
    ]);
    return {
      levelUp: level !== null,
      newLevelNo: level,
      petEvolved: evolved,
      newBadges: badges.rows.map((badge) => ({
        achievementId: badge.achievement_id,
        title: badge.title,
        rarity: badge.rarity,
        badgeImageUrl: null,
      })),
    };
  }

  /** 지급으로 오른 레벨(없으면 null): 계정에 고정된 레벨 정책 기준표로 지급 전·후 레벨 비교 */
  async levelChange(db, userId, userTx) {
    const { rows } = await db.query(
      `SELECT (SELECT max(t.level_no) FROM user_level_thresholds t
                 WHERE t.policy_version_id = e.level_policy_version_id
                   AND t.min_total_xp <= $2::bigint) AS before_level,
              (SELECT max(t.level_no) FROM user_level_thresholds t
                 WHERE t.policy_version_id = e.level_policy_version_id
                   AND t.min_total_xp <= $3::bigint) AS after_level
         FROM user_experience e WHERE e.user_id = $1`,
      [
        userId,
        String(BigInt(userTx.balance_after) - BigInt(userTx.xp_delta)),
        String(userTx.balance_after),
      ],
    );
    const { before_level: before, after_level: after } = rows[0] ?? {};
    return before != null && after != null && after > before ? after : null;
  }

  /**
   * 그 지급이 펫을 진화시켰는가.
   * 진화 이력의 occurred_at은 clock_timestamp()라 트랜잭션 시각과 다르므로,
   * 지급 직후 펫의 누적 XP(total_xp_after = 펫 거래의 balance_after)로 찾는다.
   */
  async petEvolvedBy(db, petId, petTx) {
    const { rowCount } = await db.query(
      `SELECT 1 FROM pet_evolution_events
        WHERE user_pet_id = $1 AND total_xp_after = $2::bigint
          AND occurred_at >= $3 AND to_stage_no > from_stage_no
        LIMIT 1`,
      [petId, String(petTx.balance_after), petTx.occurred_at],
    );
    return rowCount > 0;
  }

  /**
   * 회차 시작: 열려 있는 회차가 있으면 그것을 돌려줌(앱 재시작·중복 요청에 안전)
   * 시작 시 DB 트리거가 대표 펫·단계·버프를 이 회차에 고정
   */
  async startRecord(userId, missionId) {
    return this.database.withTransaction(async (tx) => {
      const mission = await this.lockMission(tx, userId, missionId);
      if (!STARTABLE_MISSION_STATUSES.includes(mission.status)) {
        throw conflict(
          'mission_not_startable',
          '수행을 시작할 수 없는 미션 상태',
          {
            status: mission.status,
          },
        );
      }
      const startsAt = kstDayStart(mission.scheduled_date);
      const deadline = this.deadlineOf(mission);
      if (Date.now() < startsAt.getTime()) {
        throw conflict(
          'mission_not_started',
          '예정일이 되기 전에는 시작할 수 없음',
          {
            startsAt: startsAt.toISOString(),
          },
        );
      }
      if (Date.now() > deadline.getTime()) {
        throw conflict('mission_expired', '마감이 지난 미션', {
          dueAt: deadline.toISOString(),
        });
      }

      const { rows: open } = await tx.query(
        `SELECT id FROM mission_records
          WHERE mission_id = $1 AND status = ANY($2::text[])
          ORDER BY attempt_no DESC LIMIT 1`,
        [missionId, OPEN_RECORD_STATUSES],
      );
      if (open[0]) {
        return {
          created: false,
          record: await this.viewRecord(tx, userId, open[0].id),
        };
      }

      const { rows: info } = await tx.query(
        `SELECT count(*) FILTER (WHERE submission_no IS NOT NULL) AS submitted,
                coalesce(max(attempt_no), 0) AS last
           FROM mission_records WHERE mission_id = $1`,
        [missionId],
      );
      if (num(info[0].submitted) >= MAX_SUBMISSIONS) {
        throw conflict(
          'submission_limit_reached',
          `인증 제출은 미션당 최대 ${MAX_SUBMISSIONS}회`,
        );
      }

      const recordId = newId();
      await tx.query(
        `INSERT INTO mission_records (id, mission_id, user_id, attempt_no, status)
         VALUES ($1, $2, $3, $4, 'recording')`,
        [recordId, missionId, userId, num(info[0].last) + 1],
      );
      if (mission.status === 'scheduled') {
        await tx.query(
          `UPDATE missions SET status = 'in_progress', updated_at = now() WHERE id = $1`,
          [missionId],
        );
      }
      return {
        created: true,
        record: await this.viewRecord(tx, userId, recordId),
      };
    });
  }

  /**
   * 제출: 증거 종류는 미션의 인증 방식으로 서버가 정함
   * 카메라는 확인된 사진·영상, 센서는 확인된 원시 파일 또는 요약(metrics)
   * 제출 번호는 미션 행 잠금 아래에서 배정해 동시 제출도 4회를 넘지 않음, 이미 제출한 회차는 그대로 반환(멱등)
   */
  async submitRecord(userId, recordId, { metrics } = {}) {
    return this.database.withTransaction(async (tx) => {
      const { mission, record } = await this.lockChain(tx, userId, recordId);

      if (record.submission_no !== null)
        return this.viewRecord(tx, userId, recordId);
      if (!OPEN_RECORD_STATUSES.includes(record.status)) {
        throw conflict('record_not_open', '제출할 수 없는 회차 상태', {
          status: record.status,
        });
      }
      if (
        mission.deleted_at ||
        ['completed', 'cancelled', 'failed'].includes(mission.status)
      ) {
        throw conflict('mission_closed', '더 이상 제출할 수 없는 미션', {
          status: mission.status,
        });
      }
      const deadline = this.deadlineOf(mission);
      if (Date.now() > deadline.getTime()) {
        throw conflict('mission_expired', '마감이 지난 미션', {
          dueAt: deadline.toISOString(),
        });
      }

      const { rows: info } = await tx.query(
        `SELECT count(*) FILTER (WHERE submission_no IS NOT NULL) AS submitted,
                coalesce(max(submission_no), 0) AS last
           FROM mission_records WHERE mission_id = $1`,
        [mission.id],
      );
      if (
        num(info[0].submitted) >= MAX_SUBMISSIONS ||
        num(info[0].last) >= MAX_SUBMISSIONS
      ) {
        throw conflict(
          'submission_limit_reached',
          `인증 제출은 미션당 최대 ${MAX_SUBMISSIONS}회`,
        );
      }

      const evidenceKind = await this.resolveEvidence(
        tx,
        mission,
        record,
        metrics,
      );

      await tx.query(
        `UPDATE mission_records
            SET status = 'submitted', submission_no = $2, submitted_at = now(),
                evidence_kind = $3, metrics = COALESCE($4::jsonb, metrics)
          WHERE id = $1`,
        [
          recordId,
          num(info[0].last) + 1,
          evidenceKind,
          metrics ? JSON.stringify(metrics) : null,
        ],
      );
      await tx.query(
        `UPDATE missions SET status = 'submitted', updated_at = now()
          WHERE id = $1 AND status IN ('in_progress', 'submitted')`,
        [mission.id],
      );
      return this.viewRecord(tx, userId, recordId);
    });
  }

  /** 업로드가 모두 확인됐는지 보고 증거 종류를 정함 */
  async resolveEvidence(tx, mission, record, metrics) {
    const { rows } = await tx.query(
      `SELECT media_kind, upload_status, count(*) AS n FROM media_files
        WHERE record_id = $1 AND upload_status IN ('pending', 'uploaded')
        GROUP BY media_kind, upload_status`,
      [record.id],
    );
    const count = (predicate) =>
      rows.filter(predicate).reduce((sum, row) => sum + num(row.n), 0);

    const pending = count((row) => row.upload_status === 'pending');
    if (pending > 0) {
      throw unprocessable(
        'upload_incomplete',
        '업로드가 확인되지 않은 파일이 있음',
        { pending },
      );
    }

    if (mission.verification_method === 'camera') {
      if (count((row) => row.media_kind.startsWith('camera_')) === 0) {
        throw unprocessable(
          'evidence_required',
          '제출할 사진 또는 영상이 필요함',
        );
      }
      return 'camera_media';
    }
    if (count((row) => row.media_kind === 'sensor_raw') > 0)
      return 'sensor_raw';

    const summary = metrics ?? record.metrics;
    if (!summary || Object.keys(summary).length === 0) {
      throw unprocessable(
        'evidence_required',
        '센서 원시 파일 또는 요약(metrics)이 필요함',
      );
    }
    return 'sensor_summary';
  }

  /**
   * 제출하지 않은 회차 포기: 회차는 aborted가 되어 제출 횟수에 들어가지 않고 파일은 정리 대상
   * 살아 있는 회차가 하나도 없으면 미션을 시작 전(scheduled)으로 되돌림
   */
  async abortRecord(userId, recordId) {
    const aborted = await this.database.withTransaction(async (tx) => {
      const { mission, record } = await this.lockChain(tx, userId, recordId);
      if (record.status === 'aborted') return { already: true };
      if (!OPEN_RECORD_STATUSES.includes(record.status)) {
        throw conflict('record_not_open', '제출한 회차는 포기할 수 없음', {
          status: record.status,
        });
      }

      await tx.query(
        `UPDATE mission_records SET status = 'aborted', completed_at = now() WHERE id = $1`,
        [recordId],
      );
      if (mission.status === 'in_progress') {
        await tx.query(
          `UPDATE missions SET status = 'scheduled', updated_at = now()
            WHERE id = $1 AND NOT EXISTS (
              SELECT 1 FROM mission_records WHERE mission_id = $1 AND status <> 'aborted')`,
          [mission.id],
        );
      }
      return { already: false };
    });

    // R2 정리는 커밋 뒤에, 실패해도 deleting으로 남아 작업이 이어서 처리
    if (!aborted.already) {
      try {
        await this.media.deleteAllForRecord(recordId);
      } catch (error) {
        this.logger.warn(
          `포기한 회차의 파일 정리 실패 ${recordId}: ${error.message}`,
        );
      }
    }
    return this.viewRecord(this.database, userId, recordId);
  }

  /** 미션의 회차 목록(시작 순), 각 회차의 현재 판정 요약과 이의 제기 가능 여부 포함 */
  async listRecords(userId, missionId) {
    const { rows: mission } = await this.database.query(
      'SELECT 1 FROM missions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [missionId, userId],
    );
    if (!mission[0]) throw missionNotFound();

    const { rows } = await this.database.query(
      `${RECORD_SELECT} WHERE r.mission_id = $1 AND r.user_id = $2 ORDER BY r.attempt_no`,
      [missionId, userId],
    );
    const files = await this.loadFiles(
      this.database,
      rows.map((row) => row.id),
    );
    const views = rows.map((row) => this.toView(row, files.get(row.id)));
    await this.attachMissionInfo(
      this.database,
      userId,
      rows.map((row, i) => ({ row, view: views[i] })),
    );
    return { items: views };
  }

  getRecord(userId, recordId) {
    return this.viewRecord(this.database, userId, recordId);
  }
}
