import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
import { conflict } from '../common/errors/http-errors.js';
import { DatabaseService } from '../database/database.service.js';

// 아직 끝나지 않은 요청 상태
const OPEN_STATUSES = ['requested', 'on_hold', 'processing'];
// 회원이 스스로 철회할 수 있는 상태(처리가 시작되면 철회 불가)
const CANCELLABLE_STATUSES = ['requested', 'on_hold'];

const view = (row) => ({
  id: row.id,
  status: row.status,
  requestedAt: row.requested_at,
  completedAt: row.completed_at,
});

/**
 * 회원 탈퇴 요청: 요청 → (관리자 검토 M15·M16) → 처리 중 → 파일 삭제 후 완료(정기 작업)
 * 처리가 시작되면 계정은 새 활동이 막히고 모든 세션이 폐기됨
 */
@Injectable()
@Dependencies(DatabaseService)
export class UserWithdrawalService {
  constructor(database) {
    this.database = database;
  }

  /** 내 가장 최근 요청, 없으면 null */
  async getCurrent(userId, db = this.database) {
    const { rows } = await db.query(
      `SELECT id, status, requested_at, completed_at
         FROM account_withdrawal_requests
        WHERE user_id = $1
        ORDER BY requested_at DESC, id DESC LIMIT 1`,
      [userId],
    );
    return { request: rows[0] ? view(rows[0]) : null };
  }

  /** 요청 접수: 끝나지 않은 요청이 있으면 409 (회원 행을 잠가 동시 요청도 하나만 통과) */
  async request(userId) {
    return this.database.withTransaction(async (tx) => {
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const { rows: open } = await tx.query(
        `SELECT 1 FROM account_withdrawal_requests
          WHERE user_id = $1 AND status = ANY($2::text[]) LIMIT 1`,
        [userId, OPEN_STATUSES],
      );
      if (open.length > 0) {
        throw conflict(
          'withdrawal_already_requested',
          '이미 탈퇴를 요청했어요.',
        );
      }
      await tx.query(
        `INSERT INTO account_withdrawal_requests (id, user_id) VALUES ($1, $2)`,
        [randomUUID(), userId],
      );
      return this.getCurrent(userId, tx);
    });
  }

  /** 철회: 접수·보류 상태만 가능, 처리 중이면 되돌릴 수 없음 */
  async cancel(userId) {
    return this.database.withTransaction(async (tx) => {
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const { rowCount } = await tx.query(
        `UPDATE account_withdrawal_requests SET status = 'cancelled'
          WHERE user_id = $1 AND status = ANY($2::text[])`,
        [userId, CANCELLABLE_STATUSES],
      );
      if (rowCount === 0) {
        throw conflict(
          'withdrawal_not_cancellable',
          '철회할 수 있는 탈퇴 요청이 없어요.',
        );
      }
      return this.getCurrent(userId, tx);
    });
  }
}
