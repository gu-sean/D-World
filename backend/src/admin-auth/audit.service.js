import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
import { adminPage } from '../common/pagination/admin-page.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * 관리자 감사 로그, 관리자 변경 API는 변경과 같은 트랜잭션(tx)에서 호출
 * 사용자 삭제 시 reason·변경 전후 값은 DB 트리거가 비움
 */
@Injectable()
@Dependencies(DatabaseService)
export class AuditService {
  constructor(database) {
    this.database = database;
  }

  /** M101 감사 로그 목록(AdminPage): action은 앞부분 일치(예: verification.) */
  async list({ adminId, action, targetUserId, result, from, to, paging }) {
    const params = [
      adminId ?? null,
      action ? `${action.replace(/[\\%_]/g, '\\$&')}%` : null,
      targetUserId ?? null,
      result ?? null,
      from ?? null,
      to ?? null,
    ];
    const where = `($1::uuid IS NULL OR l.admin_id = $1)
          AND ($2::text IS NULL OR l.action LIKE $2)
          AND ($3::uuid IS NULL OR l.target_user_id = $3)
          AND ($4::text IS NULL OR l.result = $4)
          AND ($5::timestamptz IS NULL OR l.recorded_at >= $5)
          AND ($6::timestamptz IS NULL OR l.recorded_at < $6)`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT l.id, l.admin_id, a.login_id, l.target_user_id, l.action, l.result,
                l.reason, l.before_value, l.after_value, l.recorded_at
           FROM admin_audit_logs l
           JOIN admin_accounts a ON a.id = l.admin_id
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $7 OFFSET $8`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM admin_audit_logs l WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(
      rows.map((row) => ({
        id: row.id,
        adminId: row.admin_id,
        adminLoginId: row.login_id,
        targetUserId: row.target_user_id,
        action: row.action,
        result: row.result,
        reason: row.reason,
        beforeValue: row.before_value,
        afterValue: row.after_value,
        recordedAt: row.recorded_at,
      })),
      paging,
      count.rows[0].n,
    );
  }

  async record(
    tx = this.database,
    {
      adminId,
      targetUserId = null,
      action,
      result,
      reason = null,
      before,
      after,
    },
  ) {
    await tx.query(
      `INSERT INTO admin_audit_logs
              (id, admin_id, target_user_id, action, result, reason, before_value, after_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        adminId,
        targetUserId,
        action,
        result,
        reason,
        before === undefined ? null : JSON.stringify(before),
        after === undefined ? null : JSON.stringify(after),
      ],
    );
  }
}
