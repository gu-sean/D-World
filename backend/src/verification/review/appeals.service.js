import { newId } from '../../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../../admin-auth/audit.service.js';
import { adminPage } from '../../common/pagination/admin-page.js';
import { AppException } from '../../common/errors/app-exception.js';
import { rethrowConstraint } from '../../common/errors/constraint.js';
import { AdminIdempotencyService } from '../../common/idempotency/admin-idempotency.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { memberQueryParams, memberWhere } from '../../common/member-query.js';
import { DecisionService } from '../decision.service.js';
import { APPEAL_WINDOW } from '../records/records.constants.js';
import { conflict } from '../../common/errors/http-errors.js';

const recordNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'record_not_found',
    '수행 회차를 찾을 수 없음',
  );
const appealNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'appeal_not_found',
    '이의 제기를 찾을 수 없음',
  );

const alreadyFiled = () =>
  conflict('appeal_already_filed', '이 판정에는 이미 이의 제기가 접수됨');

/**
 * 이의 제기
 * - 대상: 안내 후 7일 이내의 **AI 거절** 판정, 관리자 판정은 최종(이의 제기 불가)
 * - 처리: 관리자가 거절 유지 또는 승인으로 변경, 둘 다 새 관리자 판정 기록
 *   판정 반영은 DecisionService.applyDecision 재사용 → 늦은 승인(실패 미션 완료), 이력만 남는 경우 등 동일 규칙
 * 잠금 순서: 미션 → 회차 → 이의 제기 (판정 반영과 같은 순서)
 */
@Injectable()
@Dependencies(
  DatabaseService,
  DecisionService,
  AuditService,
  AdminIdempotencyService,
)
export class AppealsService {
  constructor(database, decisions, audit, idempotency) {
    this.database = database;
    this.decisions = decisions;
    this.audit = audit;
    this.idempotency = idempotency;
  }

  toView(row) {
    return {
      id: row.id,
      recordId: row.record_id,
      originalResultId: row.original_result_id ?? null,
      status: row.status,
      reason: row.reason,
      filedAt: row.filed_at,
      resolvedAt: row.resolved_at,
      // 처리 결과(관리자 판정)는 안내된 뒤라서 사유까지 보여 줌
      resolution: row.resolution_decision
        ? { decision: row.resolution_decision, reason: row.resolution_reason }
        : null,
    };
  }

  /** 미션 → 회차 순서로 잠금, userId가 있으면 소유자 확인(아니면 404) */
  async lockChain(tx, recordId, userId = null) {
    const { rows: probe } = await tx.query(
      userId === null
        ? 'SELECT mission_id FROM mission_records WHERE id = $1'
        : 'SELECT mission_id FROM mission_records WHERE id = $1 AND user_id = $2',
      userId === null ? [recordId] : [recordId, userId],
    );
    if (!probe[0]) throw recordNotFound();
    await tx.query('SELECT 1 FROM missions WHERE id = $1 FOR UPDATE', [
      probe[0].mission_id,
    ]);
    await tx.query('SELECT 1 FROM mission_records WHERE id = $1 FOR UPDATE', [
      recordId,
    ]);
  }

  /** 접수: 거절 안내 후 7일 이내의 AI 판정에만, 같은 판정에는 한 번만 */
  async fileAppeal(userId, recordId, reason) {
    try {
      return await this.database.withTransaction(async (tx) => {
        await this.lockChain(tx, recordId, userId);

        const { rows } = await tx.query(
          `SELECT id, decision, source, notified_at,
                  now() > notified_at + interval '${APPEAL_WINDOW}' AS expired,
                  notified_at + interval '${APPEAL_WINDOW}' AS deadline
             FROM verification_results WHERE record_id = $1 AND is_current`,
          [recordId],
        );
        const current = rows[0];
        if (!current) {
          throw conflict('appeal_not_allowed', '이의 제기할 판정이 없음', {
            reason: 'no_result',
          });
        }
        if (
          current.decision !== 'rejected' ||
          current.source !== 'ai' ||
          !current.notified_at
        ) {
          throw conflict('appeal_not_allowed', '이의 제기할 수 없는 판정', {
            decision: current.decision,
            source: current.source,
            notified: Boolean(current.notified_at),
          });
        }
        if (current.expired) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'appeal_window_closed',
            '이의 제기 기한이 지남',
            { details: { deadline: current.deadline } },
          );
        }

        const { rows: existing } = await tx.query(
          'SELECT status FROM verification_appeals WHERE original_result_id = $1',
          [current.id],
        );
        if (existing[0]) {
          throw conflict(
            'appeal_already_filed',
            '이 판정에는 이미 이의 제기가 접수됨',
            {
              status: existing[0].status,
            },
          );
        }

        const { rows: created } = await tx.query(
          `INSERT INTO verification_appeals
                  (id, record_id, filed_by_user_id, original_result_id, reason)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, record_id, original_result_id, status, reason, filed_at, resolved_at`,
          [newId(), recordId, userId, current.id, reason],
        );
        return this.toView(created[0]);
      });
    } catch (error) {
      rethrowConstraint(error, {
        verification_appeals_original_result_id_key: alreadyFiled,
      });
    }
  }

  /** A46: 판정 ID로 이의 제기, 현재 판정이 아니면 이의 제기할 수 없음 */
  async fileAppealByResult(userId, resultId, reason) {
    const { rows } = await this.database.query(
      `SELECT vr.record_id, vr.is_current
         FROM verification_results vr
         JOIN mission_records r ON r.id = vr.record_id
        WHERE vr.id = $1 AND r.user_id = $2`,
      [resultId, userId],
    );
    if (!rows[0]) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'result_not_found',
        '판정을 찾을 수 없음',
      );
    }
    if (!rows[0].is_current) {
      throw conflict('appeal_not_allowed', '이의 제기할 수 없는 판정', {
        reason: 'not_current',
      });
    }
    return this.fileAppeal(userId, rows[0].record_id, reason);
  }

  /** 내 회차의 이의 제기 목록과 처리 결과 */
  async listForRecord(userId, recordId) {
    const { rows: owner } = await this.database.query(
      'SELECT 1 FROM mission_records WHERE id = $1 AND user_id = $2',
      [recordId, userId],
    );
    if (!owner[0]) throw recordNotFound();
    const { rows } = await this.database.query(
      `SELECT a.id, a.record_id, a.status, a.reason, a.filed_at, a.resolved_at,
              rr.decision AS resolution_decision, rr.reason AS resolution_reason
         FROM verification_appeals a
         LEFT JOIN verification_results rr ON rr.id = a.resolution_result_id
        WHERE a.record_id = $1 AND a.filed_by_user_id = $2
        ORDER BY a.filed_at, a.id`,
      [recordId, userId],
    );
    return { items: rows.map((row) => this.toView(row)) };
  }

  /** M34 관리자 이의 제기 목록(AdminPage), 기본 open, 원 판정(AI 의견)과 미션 조건을 함께 보여 줌 */
  async list({ status, member, paging }) {
    // member: 닉네임 또는 회원 ID (common/member-query.js)
    const search = memberQueryParams(member);
    const where = `a.status = $1 AND ${memberWhere('r.user_id', '$2', '$3')}`;
    const params = [status, search.like, search.id];
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT a.id, a.record_id, a.status, a.reason, a.filed_at,
                a.resolved_at, r.mission_id, r.user_id, r.attempt_no, r.submission_no,
                m.title, m.verification_method, m.status AS mission_status,
                vr.engine_version, vr.confidence, vr.reason AS ai_reason, vr.decided_at,
                vr.notified_at, vr.decision AS original_decision, p.nickname
           FROM verification_appeals a
           JOIN mission_records r ON r.id = a.record_id
           JOIN missions m ON m.id = r.mission_id
           JOIN verification_results vr ON vr.id = a.original_result_id
           LEFT JOIN profiles p ON p.user_id = r.user_id
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $4 OFFSET $5`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM verification_appeals a
           JOIN mission_records r ON r.id = a.record_id
          WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(
      rows.map((row) => ({
        id: row.id,
        recordId: row.record_id,
        missionId: row.mission_id,
        userId: row.user_id,
        nickname: row.nickname,
        missionTitle: row.title,
        originalDecision: row.original_decision,
        attemptNo: row.attempt_no,
        submissionNo: row.submission_no,
        status: row.status,
        reason: row.reason,
        filedAt: row.filed_at,
        resolvedAt: row.resolved_at,
        mission: {
          title: row.title,
          verificationMethod: row.verification_method,
          status: row.mission_status,
        },
        originalResult: {
          engineVersion: row.engine_version,
          confidence: row.confidence === null ? null : Number(row.confidence),
          reason: row.ai_reason,
          decidedAt: row.decided_at,
          notifiedAt: row.notified_at,
        },
      })),
      paging,
      count.rows[0].n,
    );
  }

  /** M35 관리자용 이의 제기 단건 (처리 결과 포함) */
  async getForAdmin(appealId) {
    const { rows } = await this.database.query(
      `SELECT a.id, a.record_id, a.status, a.reason, a.filed_at, a.resolved_at,
              rr.decision AS resolution_decision, rr.reason AS resolution_reason
         FROM verification_appeals a
         LEFT JOIN verification_results rr ON rr.id = a.resolution_result_id
        WHERE a.id = $1`,
      [appealId],
    );
    if (!rows[0]) throw recordNotFound();
    return { view: this.toView(rows[0]), recordId: rows[0].record_id };
  }

  /**
   * 처리: outcome이 accepted면 승인으로 변경, rejected면 거절을 유지(새 관리자 판정을 남김)
   * 판정 반영·이의 제기 종결·감사 로그·멱등 기록이 한 트랜잭션, 같은 Idempotency-Key는 저장된 응답을 재생
   */
  resolve(adminId, { appealId, outcome, reason, key }) {
    return this.idempotency.run(
      adminId,
      {
        key,
        operation: 'appeal.resolve',
        payload: { appealId, outcome, reason },
      },
      async (tx) => {
        const { rows: probe } = await tx.query(
          'SELECT record_id FROM verification_appeals WHERE id = $1',
          [appealId],
        );
        if (!probe[0]) throw appealNotFound();
        const recordId = probe[0].record_id;

        await this.lockChain(tx, recordId);
        const { rows: locked } = await tx.query(
          `SELECT a.status, a.original_result_id, r.user_id, r.status AS record_status,
                  m.status AS mission_status
             FROM verification_appeals a
             JOIN mission_records r ON r.id = a.record_id
             JOIN missions m ON m.id = r.mission_id
            WHERE a.id = $1 FOR UPDATE OF a`,
          [appealId],
        );
        const appeal = locked[0];
        if (appeal.status !== 'open') {
          throw conflict('appeal_not_open', '이미 처리된 이의 제기', {
            status: appeal.status,
          });
        }
        // 접수 뒤 다른 경로로 회차가 다시 판정됐다면 이 이의 제기는 더 이상 유효하지 않음
        const { rows: current } = await tx.query(
          'SELECT id FROM verification_results WHERE record_id = $1 AND is_current',
          [recordId],
        );
        if (current[0]?.id !== appeal.original_result_id) {
          throw conflict(
            'appeal_obsolete',
            '접수한 뒤 회차가 다시 판정되어 처리할 수 없음',
          );
        }

        const decision = outcome === 'accepted' ? 'approved' : 'rejected';
        const result = await this.decisions.applyDecision(tx, {
          recordId,
          source: 'admin',
          decision,
          reason,
          adminId,
          allowedStatuses: ['rejected'],
        });
        await tx.query(
          `UPDATE verification_appeals
              SET status = $2, reviewed_by_admin_id = $3, resolution_result_id = $4,
                  resolved_at = now()
            WHERE id = $1`,
          [appealId, outcome, adminId, result.resultId],
        );
        await this.audit.record(tx, {
          adminId,
          targetUserId: appeal.user_id,
          action: 'appeal.resolve',
          result: 'success',
          reason,
          before: {
            recordStatus: appeal.record_status,
            missionStatus: appeal.mission_status,
          },
          after: {
            outcome,
            decision,
            transition: result.transition,
            missionStatus: result.missionStatus,
          },
        });
        return {
          appealId,
          recordId,
          status: outcome,
          resultId: result.resultId,
          decision,
          transition: result.transition,
          missionStatus: result.missionStatus,
        };
      },
    );
  }
}
