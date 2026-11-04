import { randomUUID } from 'node:crypto';
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
         vr.notified_at + interval '${APPEAL_WINDOW}' AS appeal_deadline,
         a.status AS appeal_status,
         (vr.decision = 'rejected' AND vr.source = 'ai' AND vr.notified_at IS NOT NULL
            AND now() <= vr.notified_at + interval '${APPEAL_WINDOW}' AND a.id IS NULL) AS can_appeal
    FROM mission_records r
    LEFT JOIN verification_results vr ON vr.record_id = r.id AND vr.is_current
    LEFT JOIN verification_appeals a ON a.record_id = r.id
     AND (a.original_result_id = vr.id OR a.resolution_result_id = vr.id)`;

/**
 * 수행 회차 (3-C-2): 시작, 제출, 포기, 조회
 * 판정·보상 반영은 3-C-3. 이 단계는 미션 상태 scheduled → in_progress → submitted까지
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
      `SELECT id, record_id, media_kind, upload_status FROM media_files
        WHERE record_id = ANY($1::uuid[]) AND upload_status <> 'deleted'
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
    return this.toView(rows[0], files.get(recordId));
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

      const recordId = randomUUID();
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
      } catch (err) {
        this.logger.warn(
          `포기한 회차의 파일 정리 실패 ${recordId}: ${err.message}`,
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
    return { items: rows.map((row) => this.toView(row, files.get(row.id))) };
  }

  getRecord(userId, recordId) {
    return this.viewRecord(this.database, userId, recordId);
  }
}
