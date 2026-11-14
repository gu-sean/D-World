import { newId } from '../common/ids.js';
import { Dependencies, Injectable } from '@nestjs/common';
import { adminPage } from '../common/pagination/admin-page.js';
import {
  ID_PATTERN,
  escapeLike,
  memberQueryParams,
  memberWhere,
  nicknameOf,
} from '../common/member-query.js';
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
  async list({
    adminId,
    admin,
    action,
    targetUserId,
    member,
    result,
    from,
    to,
    paging,
  }) {
    const target = memberQueryParams(member);
    const adminText = typeof admin === 'string' ? admin.trim() : '';
    const adminIsId = ID_PATTERN.test(adminText);
    const params = [
      adminId ?? (adminIsId ? adminText : null),
      action ? `${escapeLike(action)}%` : null,
      targetUserId ?? target.id,
      result ?? null,
      from ?? null,
      to ?? null,
      target.like,
      adminText && !adminIsId ? `%${escapeLike(adminText)}%` : null,
    ];
    const where = `($1::short_id IS NULL OR l.admin_id = $1)
          AND ($2::text IS NULL OR l.action LIKE $2)
          AND ${memberWhere('l.target_user_id', '$7', '$3')}
          AND ($4::text IS NULL OR l.result = $4)
          AND ($5::timestamptz IS NULL OR l.recorded_at >= $5)
          AND ($6::timestamptz IS NULL OR l.recorded_at < $6)
          AND ($8::text IS NULL OR l.admin_id IN (
                SELECT aa.id FROM admin_accounts aa WHERE aa.login_id ILIKE $8))`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT l.id, l.admin_id, a.login_id, l.target_user_id, l.action, l.result,
                l.reason, l.before_value, l.after_value, l.recorded_at,
                ${nicknameOf('l.target_user_id')} AS target_nickname
           FROM admin_audit_logs l
           JOIN admin_accounts a ON a.id = l.admin_id
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $9 OFFSET $10`,
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
        targetNickname: row.target_nickname ?? null,
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
        newId(),
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
