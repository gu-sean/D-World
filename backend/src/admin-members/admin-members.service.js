import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
import { conflict } from '../common/errors/http-errors.js';

export const REASON_RULE_OPTIONS = {
  min: 1,
  max: 500,
  pattern: /\S/,
  patternMessage: '공백만 입력할 수 없음',
};

export const accountActionView = (row) => ({
  id: row.id,
  userId: row.user_id,
  adminId: row.admin_id,
  actionType: row.action_type,
  reason: row.reason,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  liftedAt: row.lifted_at,
  sourceTicketId: row.source_ticket_id,
  createdAt: row.created_at,
});

const NOTICE = {
  warning: ['운영 정책 위반 경고', '운영 정책 위반으로 경고가 부여되었어요.'],
  restriction: [
    '이용 제한 안내',
    '운영 정책 위반으로 일정 기간 새 활동을 할 수 없어요.',
  ],
};

/** 회원 이용 조치 공통 처리: M13(직접 부여)과 M24(신고 처리)가 함께 사용 */
@Injectable()
@Dependencies()
export class AdminMembersService {
  /**
   * 경고·이용 제한 부여 + 대상 회원 알림, tx 안에서 호출
   * 진행 중인 이용 제한이 있는데 또 제한이면 ADMIN_ACTION_CONFLICT
   */
  async createAccountAction(
    tx,
    { adminId, userId, actionType, days, reason, sourceTicketId = null },
  ) {
    if (actionType === 'restriction') {
      const { rows } = await tx.query(
        `SELECT 1 FROM account_actions
          WHERE user_id = $1 AND action_type = 'restriction'
            AND lifted_at IS NULL AND ends_at > now()
          LIMIT 1`,
        [userId],
      );
      if (rows.length > 0) {
        throw conflict(
          'ADMIN_ACTION_CONFLICT',
          '이미 진행 중인 이용 제한이 있어요.',
        );
      }
    }
    const id = randomUUID();
    const { rows } = await tx.query(
      `INSERT INTO account_actions
         (id, user_id, admin_id, action_type, reason, starts_at, ends_at,
          source_ticket_id)
       VALUES ($1, $2, $3, $4::varchar, $5, now(),
               CASE WHEN $4::varchar = 'restriction'
                    THEN now() + make_interval(days => $6::int) END,
               $7)
       RETURNING *`,
      [
        id,
        userId,
        adminId,
        actionType,
        reason,
        actionType === 'restriction' ? days : null,
        sourceTicketId,
      ],
    );
    const [title, body] = NOTICE[actionType];
    await tx.query(
      `INSERT INTO user_notifications (id, user_id, kind, event_key, title, body)
       VALUES ($1, $2, 'system', $3, $4, $5)`,
      [randomUUID(), userId, `account_action:${id}`, title, body],
    );
    return rows[0];
  }
}
