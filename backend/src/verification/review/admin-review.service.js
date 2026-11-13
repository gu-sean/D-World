import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../../admin-auth/audit.service.js';
import { adminPage } from '../../common/pagination/admin-page.js';
import { AppException } from '../../common/errors/app-exception.js';
import { AdminIdempotencyService } from '../../common/idempotency/admin-idempotency.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { MediaService } from '../../media/media.service.js';
import { DecisionService } from '../decision.service.js';

const num = (value) => Number(value);

const recordNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'record_not_found',
    '수행 회차를 찾을 수 없음',
  );

/**
 * 관리자 보류 검수
 * AI 보류(review_required) 회차를 원본·조건을 보고 승인·거절
 * 판정 반영·감사 로그·멱등 기록이 한 트랜잭션
 */
@Injectable()
@Dependencies(
  DatabaseService,
  DecisionService,
  AuditService,
  AdminIdempotencyService,
  MediaService,
)
export class AdminReviewService {
  constructor(database, decisions, audit, idempotency, media) {
    this.database = database;
    this.decisions = decisions;
    this.audit = audit;
    this.idempotency = idempotency;
    this.media = media;
  }

  /**
   * M30 인증 검수 목록(AdminPage): 상태·방식·사용자 필터, 기본은 보류(review_required)
   * 미션 조건과 AI 의견을 함께 보여 줌
   */
  async list({ status, method, userId, paging }) {
    const params = [status, method ?? null, userId ?? null];
    const where = `r.status = $1
          AND ($2::text IS NULL OR m.verification_method = $2)
          AND ($3::uuid IS NULL OR r.user_id = $3)`;
    const [{ rows }, count, completed] = await Promise.all([
      this.database.query(
        `SELECT r.id, r.mission_id, r.user_id, r.attempt_no, r.submission_no, r.evidence_kind,
                r.submitted_at, r.metrics AS record_metrics, r.status,
                m.title, m.description, m.verification_method, m.target_value, m.target_unit,
                m.category_id, m.scheduled_date, m.status AS mission_status,
                vr.engine_version, vr.confidence, vr.reason AS ai_reason, vr.metrics AS ai_metrics,
                vr.decided_at
           FROM mission_records r
           JOIN missions m ON m.id = r.mission_id
           LEFT JOIN verification_results vr ON vr.record_id = r.id AND vr.is_current
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $4 OFFSET $5`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM mission_records r JOIN missions m ON m.id = r.mission_id WHERE ${where}`,
        params,
      ),
      this.database.query(
        `SELECT count(*) AS n FROM verification_results
          WHERE source = 'admin' AND decided_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`,
      ),
    ]);
    return {
      completedToday: num(completed.rows[0].n),
      page: adminPage(
        rows.map((row) => ({
          recordId: row.id,
          missionId: row.mission_id,
          userId: row.user_id,
          status: row.status,
          attemptNo: row.attempt_no,
          submissionNo: row.submission_no,
          evidenceKind: row.evidence_kind,
          submittedAt: row.submitted_at,
          recordMetrics: row.record_metrics,
          mission: {
            title: row.title,
            description: row.description,
            status: row.mission_status,
            verificationMethod: row.verification_method,
            targetValue:
              row.target_value === null ? null : num(row.target_value),
            targetUnit: row.target_unit,
            categoryId: row.category_id,
            scheduledDate: row.scheduled_date,
          },
          ai: {
            engineVersion: row.engine_version,
            confidence: row.confidence === null ? null : num(row.confidence),
            reason: row.ai_reason,
            metrics: row.ai_metrics,
            decidedAt: row.decided_at,
          },
        })),
        paging,
        count.rows[0].n,
      ),
    };
  }

  /** 회차 상세: 미션 조건, 판정 이력 전체, 이의 제기, 증거 파일의 조회용 URL(짧은 유효 시간) */
  async getRecord(recordId) {
    const { rows } = await this.database.query(
      `SELECT r.id, r.mission_id, r.user_id, r.attempt_no, r.submission_no, r.status,
              r.evidence_kind, r.started_at, r.submitted_at, r.completed_at, r.metrics,
              m.title, m.description, m.verification_method, m.target_value, m.target_unit,
              m.category_id, m.scheduled_date, m.status AS mission_status,
              p.nickname
         FROM mission_records r
         JOIN missions m ON m.id = r.mission_id
         LEFT JOIN profiles p ON p.user_id = r.user_id
        WHERE r.id = $1`,
      [recordId],
    );
    const record = rows[0];
    if (!record) throw recordNotFound();

    const [results, appeals, files] = await Promise.all([
      this.database.query(
        `SELECT id, result_no, source, decision, engine_version, confidence, metrics, reason,
                reviewed_by_admin_id, is_current, decided_at, notified_at
           FROM verification_results WHERE record_id = $1 ORDER BY result_no`,
        [recordId],
      ),
      this.database.query(
        `SELECT id, original_result_id, reason, status, filed_at, resolved_at
           FROM verification_appeals WHERE record_id = $1 ORDER BY filed_at`,
        [recordId],
      ),
      this.database.query(
        `SELECT id, media_kind, mime_type, actual_size_bytes, upload_status
           FROM media_files WHERE record_id = $1 AND upload_status <> 'deleted'
          ORDER BY created_at, id`,
        [recordId],
      ),
    ]);

    const fileViews = [];
    for (const file of files.rows) {
      const view = {
        id: file.id,
        mediaKind: file.media_kind,
        mimeType: file.mime_type,
        sizeBytes:
          file.actual_size_bytes === null ? null : num(file.actual_size_bytes),
        status: file.upload_status,
        url: null,
      };
      if (file.upload_status === 'uploaded') {
        view.url = (await this.media.signedUrlForAdmin(file.id)).url;
      }
      fileViews.push(view);
    }

    return {
      recordId: record.id,
      missionId: record.mission_id,
      userId: record.user_id,
      userNickname: record.nickname,
      attemptNo: record.attempt_no,
      submissionNo: record.submission_no,
      status: record.status,
      evidenceKind: record.evidence_kind,
      startedAt: record.started_at,
      submittedAt: record.submitted_at,
      completedAt: record.completed_at,
      metrics: record.metrics,
      mission: {
        title: record.title,
        description: record.description,
        status: record.mission_status,
        verificationMethod: record.verification_method,
        targetValue:
          record.target_value === null ? null : num(record.target_value),
        targetUnit: record.target_unit,
        categoryId: record.category_id,
        scheduledDate: record.scheduled_date,
      },
      results: results.rows.map((r) => ({
        id: r.id,
        resultNo: r.result_no,
        source: r.source,
        decision: r.decision,
        engineVersion: r.engine_version,
        confidence: r.confidence === null ? null : num(r.confidence),
        metrics: r.metrics,
        reason: r.reason,
        reviewedByAdminId: r.reviewed_by_admin_id,
        isCurrent: r.is_current,
        decidedAt: r.decided_at,
        notifiedAt: r.notified_at,
      })),
      appeals: appeals.rows.map((a) => ({
        id: a.id,
        originalResultId: a.original_result_id,
        reason: a.reason,
        status: a.status,
        filedAt: a.filed_at,
        resolvedAt: a.resolved_at,
      })),
      files: fileViews,
    };
  }

  /** 보류(review_required) 회차를 승인·거절, 같은 Idempotency-Key로 다시 보내면 저장된 응답을 재생 */
  decide(adminId, { recordId, decision, reason, key }) {
    return this.idempotency.run(
      adminId,
      {
        key,
        operation: 'verification.decide',
        payload: { recordId, decision, reason },
      },
      async (tx) => {
        const before = await tx.query(
          `SELECT r.status AS record_status, m.status AS mission_status, m.user_id
             FROM mission_records r JOIN missions m ON m.id = r.mission_id WHERE r.id = $1`,
          [recordId],
        );
        if (!before.rows[0]) throw recordNotFound();

        const result = await this.decisions.applyDecision(tx, {
          recordId,
          source: 'admin',
          decision,
          reason,
          adminId,
          allowedStatuses: ['review_required'],
        });
        await this.audit.record(tx, {
          adminId,
          targetUserId: before.rows[0].user_id,
          action: 'verification.decide',
          result: 'success',
          reason,
          before: {
            recordStatus: before.rows[0].record_status,
            missionStatus: before.rows[0].mission_status,
          },
          after: {
            decision,
            transition: result.transition,
            missionStatus: result.missionStatus,
          },
        });
        return {
          recordId,
          resultId: result.resultId,
          decision,
          transition: result.transition,
          missionStatus: result.missionStatus,
        };
      },
    );
  }
}
