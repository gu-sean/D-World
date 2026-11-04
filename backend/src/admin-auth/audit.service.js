import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
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
