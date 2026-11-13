import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { SessionKind } from '../common/auth/auth.constants.js';
import { SessionsService } from '../common/auth/sessions.service.js';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import { maskEmail, maskPhone } from '../common/masking.js';
import {
  adminPage,
  parseAdminPage,
  pickEnum,
} from '../common/pagination/admin-page.js';
import {
  idOf,
  integer,
  oneOf,
  string,
  timestamp,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import {
  accountActionView,
  AdminMembersService,
  REASON_RULE_OPTIONS,
} from './admin-members.service.js';

const WITHDRAWAL_STATUSES = [
  'requested',
  'on_hold',
  'processing',
  'completed',
  'cancelled',
];
const NEXT_WITHDRAWAL = {
  requested: ['on_hold', 'processing'],
  on_hold: ['processing'],
};
const ACTIVITY_TYPES = ['verification', 'report', 'point', 'inquiry'];

const withdrawalView = (row) => ({
  id: row.id,
  userId: row.user_id,
  nickname: row.nickname ?? null,
  status: row.status,
  requestedAt: row.requested_at,
  reviewedByAdminId: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  reason: row.reason,
  completedAt: row.completed_at,
  dataScope: {
    deleteCount: Number(row.delete_count ?? 0),
    anonymizeCount: Number(row.anonymize_count ?? 0),
    retainCount: Number(row.retain_count ?? 0),
  },
});

/**
 * 탈퇴 처리 때 데이터가 어떻게 되는지의 예상 건수 (회원 삭제 시 하위 데이터는 연쇄 삭제)
 * - 삭제: 회원 소유 목표·미션·인증·원본 파일·포인트/XP 거래·알림·챌린지 참여·업적
 * - 익명화: 접수한 문의·신고, 확정 챌린지 순위 (개인 식별만 지우고 보존)
 * - 보존: 이 회원을 대상으로 한 관리자 감사 로그
 */
const DATA_SCOPE_COLUMNS = `
  (SELECT (SELECT count(*) FROM goals WHERE user_id = w.user_id)
        + (SELECT count(*) FROM missions WHERE user_id = w.user_id)
        + (SELECT count(*) FROM mission_records WHERE user_id = w.user_id)
        + (SELECT count(*) FROM media_files WHERE user_id = w.user_id)
        + (SELECT count(*) FROM point_transactions WHERE user_id = w.user_id)
        + (SELECT count(*) FROM experience_transactions WHERE user_id = w.user_id)
        + (SELECT count(*) FROM user_notifications WHERE user_id = w.user_id)
        + (SELECT count(*) FROM challenge_participations WHERE user_id = w.user_id)
        + (SELECT count(*) FROM user_achievements WHERE user_id = w.user_id)
  ) AS delete_count,
  (SELECT (SELECT count(*) FROM support_tickets WHERE reporter_user_id = w.user_id)
        + (SELECT count(*) FROM challenge_final_rankings f
            JOIN challenge_participations cp ON cp.id = f.participation_id
           WHERE cp.user_id = w.user_id)
  ) AS anonymize_count,
  (SELECT count(*) FROM admin_audit_logs WHERE target_user_id = w.user_id) AS retain_count`;

const WITHDRAWAL_SELECT = `SELECT w.*, p.nickname, ${DATA_SCOPE_COLUMNS}
   FROM account_withdrawal_requests w
   LEFT JOIN profiles p ON p.user_id = w.user_id`;

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 관리자 회원 API: 목록·상세·활동(M10~M12), 이용 조치(M13·M14), 탈퇴 요청(M15·M16) */
@Controller('admin/v1')
@AdminOnly()
@Dependencies(
  DatabaseService,
  AdminMutationService,
  AdminMembersService,
  SessionsService,
)
export class AdminMembersController {
  constructor(database, mutation, members, sessions) {
    this.database = database;
    this.mutation = mutation;
    this.members = members;
    this.sessions = sessions;
  }

  /** M10 */
  @Get('users')
  @Bind(Query())
  async list(query) {
    const filters = validateBody(query, {
      joinedFrom: timestamp({ optional: true }),
      joinedTo: timestamp({ optional: true }),
    });
    const status = pickEnum(query, 'status', [
      'active',
      'withdrawal_processing',
    ]);
    const restricted = pickEnum(query, 'restricted', ['true', 'false']);
    const paging = parseAdminPage(query, {
      'createdAt,desc': 'u.created_at DESC, u.id DESC',
      'createdAt,asc': 'u.created_at ASC, u.id ASC',
    });
    const text = typeof query.query === 'string' ? query.query.trim() : '';
    const params = [
      text && !UUID_PATTERN.test(text) ? `%${escapeLike(text)}%` : null,
      text && UUID_PATTERN.test(text) ? text : null,
      status ?? null,
      restricted === undefined ? null : restricted === 'true',
      filters.joinedFrom ?? null,
      filters.joinedTo ?? null,
    ];
    const restrictedNow = `EXISTS (SELECT 1 FROM account_actions a
             WHERE a.user_id = u.id AND a.action_type = 'restriction'
               AND a.lifted_at IS NULL AND a.starts_at <= now()
               AND a.ends_at > now())`;
    const where = `($1::text IS NULL OR p.nickname ILIKE $1)
      AND ($2::uuid IS NULL OR u.id = $2)
      AND ($3::text IS NULL OR u.status = $3)
      AND ($5::timestamptz IS NULL OR u.created_at >= $5)
      AND ($6::timestamptz IS NULL OR u.created_at < $6)
      AND ($4::boolean IS NULL OR $4 = ${restrictedNow})`;
    const from = 'FROM users u LEFT JOIN profiles p ON p.user_id = u.id';
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT u.id, u.status, u.created_at, p.nickname,
                ${restrictedNow} AS restricted,
                (SELECT phone_e164 FROM phone_credentials WHERE user_id = u.id) AS phone_e164,
                (SELECT email FROM user_identities
                  WHERE user_id = u.id AND email IS NOT NULL
                  ORDER BY linked_at LIMIT 1) AS email,
                (SELECT jsonb_build_object('actionId', a.id, 'endsAt', a.ends_at)
                   FROM account_actions a
                  WHERE a.user_id = u.id AND a.action_type = 'restriction'
                    AND a.lifted_at IS NULL AND a.starts_at <= now() AND a.ends_at > now()
                  ORDER BY a.ends_at DESC LIMIT 1) AS restriction
           ${from} WHERE ${where}
          ORDER BY ${paging.orderBy} LIMIT $7 OFFSET $8`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n ${from} WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(
      rows.map((row) => ({
        id: row.id,
        nickname: row.nickname,
        status: row.status,
        restricted: row.restricted,
        joinedAt: row.created_at,
        // 관리자 웹 형식 (위 필드는 기존 호환으로 유지)
        createdAt: row.created_at,
        maskedPhoneNumber: maskPhone(row.phone_e164),
        maskedEmail: row.email ? maskEmail(row.email) : null,
        restriction: row.restriction,
      })),
      paging,
      count.rows[0].n,
    );
  }

  /** M11: 휴대폰·이메일은 마스킹 */
  @Get('users/:userId')
  @Bind(Param('userId'))
  async get(userId) {
    const id = idOf(userId);
    const { rows } = await this.database.query(
      `SELECT u.id, u.status, u.created_at, p.nickname, p.notification_enabled,
              c.phone_e164,
              (SELECT available_points FROM point_wallets WHERE user_id = u.id) AS available_points,
              (SELECT level_no FROM user_experience WHERE user_id = u.id) AS level_no,
              (SELECT current_success_days FROM streak_states WHERE user_id = u.id) AS streak_days,
              (SELECT count(*) FROM goals WHERE user_id = u.id AND deleted_at IS NULL) AS goal_count,
              (SELECT count(*) FROM missions WHERE user_id = u.id AND status = 'completed') AS completed_mission_count,
              (SELECT max(submitted_at) FROM mission_records WHERE user_id = u.id) AS last_activity_at
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN phone_credentials c ON c.user_id = u.id
        WHERE u.id = $1`,
      [id],
    );
    if (rows.length === 0) {
      throw notFound('user_not_found', '회원을 찾을 수 없음');
    }
    const [identities, actions, withdrawal] = await Promise.all([
      this.database.query(
        `SELECT provider, email, linked_at FROM user_identities
          WHERE user_id = $1 ORDER BY linked_at`,
        [id],
      ),
      this.database.query(
        `SELECT * FROM account_actions WHERE user_id = $1
          ORDER BY starts_at DESC, id DESC`,
        [id],
      ),
      this.database.query(
        `${WITHDRAWAL_SELECT} WHERE w.user_id = $1
          ORDER BY w.requested_at DESC LIMIT 1`,
        [id],
      ),
    ]);
    const user = rows[0];
    const now = Date.now();
    const accountActions = actions.rows.map(accountActionView);
    const inForce = (action) =>
      action.actionType === 'restriction' &&
      !action.liftedAt &&
      new Date(action.startsAt).getTime() <= now &&
      new Date(action.endsAt).getTime() > now;
    const activeRestriction = accountActions.find(inForce);
    const firstEmail = identities.rows.find((row) => row.email)?.email;
    return {
      id: user.id,
      nickname: user.nickname,
      status: user.status,
      joinedAt: user.created_at,
      notificationEnabled: user.notification_enabled,
      phone: maskPhone(user.phone_e164),
      // 관리자 웹 형식 (위 필드는 기존 호환으로 유지)
      createdAt: user.created_at,
      maskedPhoneNumber: maskPhone(user.phone_e164),
      maskedEmail: firstEmail ? maskEmail(firstEmail) : null,
      restriction: activeRestriction
        ? { actionId: activeRestriction.id, endsAt: activeRestriction.endsAt }
        : null,
      providers: [
        ...(user.phone_e164 ? ['phone'] : []),
        ...identities.rows.map((row) => row.provider),
      ],
      availablePoints: Number(user.available_points ?? 0),
      levelNo: user.level_no ?? 1,
      streakDays: user.streak_days ?? 0,
      goalCount: Number(user.goal_count),
      completedMissionCount: Number(user.completed_mission_count),
      lastActivityAt: user.last_activity_at,
      identities: identities.rows.map((row) => ({
        provider: row.provider,
        email: maskEmail(row.email),
        linkedAt: row.linked_at,
      })),
      restricted: accountActions.some(
        (action) =>
          action.actionType === 'restriction' &&
          !action.liftedAt &&
          new Date(action.startsAt).getTime() <= now &&
          new Date(action.endsAt).getTime() > now,
      ),
      accountActions,
      withdrawalRequest: withdrawal.rows[0]
        ? withdrawalView(withdrawal.rows[0])
        : null,
    };
  }

  /** M12: 인증·신고·포인트·문의를 최신순으로 합침 */
  @Get('users/:userId/activities')
  @Bind(Param('userId'), Query())
  async activities(userId, query) {
    const id = idOf(userId);
    const type = pickEnum(query, 'type', ACTIVITY_TYPES);
    const paging = parseAdminPage(query, {
      'occurredAt,desc': 'occurred_at DESC, id DESC',
    });
    const source = `(
      SELECT 'verification' AS type, r.id, r.submitted_at AS occurred_at,
             r.status AS summary, r.status AS result
        FROM mission_records r
       WHERE r.user_id = $1 AND r.submitted_at IS NOT NULL
      UNION ALL
      SELECT t.ticket_type, t.id, t.received_at, t.subject, t.status
        FROM support_tickets t WHERE t.reporter_user_id = $1
      UNION ALL
      SELECT 'point', x.id, x.occurred_at, x.kind,
             CASE WHEN x.available_delta > 0 THEN '+' ELSE '' END || x.available_delta || ' P'
        FROM point_transactions x WHERE x.user_id = $1
    ) a WHERE ($2::text IS NULL OR a.type = $2)`;
    const params = [id, type ?? null];
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT type, id, occurred_at, summary, result FROM ${source}
          ORDER BY ${paging.orderBy} LIMIT $3 OFFSET $4`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(`SELECT count(*) AS n FROM ${source}`, params),
    ]);
    return adminPage(
      rows.map((row) => ({
        type: row.type,
        id: row.id,
        occurredAt: row.occurred_at,
        summary: row.summary,
        targetId: row.id,
        result: row.result,
      })),
      paging,
      count.rows[0].n,
    );
  }

  /** M13: 경고·이용 제한 부여 */
  @Post('users/:userId/account-actions')
  @Bind(Req(), Param('userId'), Body())
  create(request, userId, body) {
    const id = idOf(userId);
    const input = validateBody(body, {
      actionType: oneOf(['warning', 'restriction']),
      days: integer({ min: 1, max: 365, optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    if ((input.actionType === 'restriction') !== (input.days !== undefined)) {
      throw new BadRequestException(['days는 이용 제한일 때만 필요함']);
    }
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'account_action.create',
      payload: { userId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT 1 FROM users WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('user_not_found', '회원을 찾을 수 없음');
        }
        const row = await this.members.createAccountAction(tx, {
          adminId,
          userId: id,
          actionType: input.actionType,
          days: input.days,
          reason: input.reason.trim(),
        });
        return { result: accountActionView(row), targetUserId: id };
      },
    });
  }

  /** M14: 조치 해제 */
  @Post('account-actions/:actionId/lift')
  @HttpCode(200)
  @Bind(Req(), Param('actionId'), Body())
  lift(request, actionId, body) {
    const id = idOf(actionId);
    const input = validateBody(body, { reason: string(REASON_RULE_OPTIONS) });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'account_action.lift',
      payload: { actionId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT * FROM account_actions WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('action_not_found', '조치를 찾을 수 없음');
        }
        const current = rows[0];
        const ended =
          current.ends_at !== null && new Date(current.ends_at) <= new Date();
        if (current.lifted_at || ended) {
          throw conflict(
            'ADMIN_STATE_CONFLICT',
            '이미 끝났거나 해제된 조치예요.',
          );
        }
        const updated = await tx.query(
          `UPDATE account_actions SET lifted_at = now()
            WHERE id = $1 RETURNING *`,
          [id],
        );
        return {
          result: accountActionView(updated.rows[0]),
          before: { liftedAt: null },
          after: { liftedAt: updated.rows[0].lifted_at },
          targetUserId: current.user_id,
        };
      },
    });
  }

  /** M15 */
  @Get('withdrawal-requests')
  @Bind(Query())
  async listWithdrawals(query) {
    const status = pickEnum(query, 'status', WITHDRAWAL_STATUSES);
    const paging = parseAdminPage(query, {
      'requestedAt,asc': 'w.requested_at ASC, w.id ASC',
      'requestedAt,desc': 'w.requested_at DESC, w.id DESC',
    });
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `${WITHDRAWAL_SELECT}
          WHERE ($1::text IS NULL OR w.status = $1)
          ORDER BY ${paging.orderBy} LIMIT $2 OFFSET $3`,
        [status ?? null, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM account_withdrawal_requests w
          WHERE ($1::text IS NULL OR w.status = $1)`,
        [status ?? null],
      ),
    ]);
    return adminPage(rows.map(withdrawalView), paging, count.rows[0].n);
  }

  /** M16: 보류·처리 시작, 처리 시작하면 회원을 탈퇴 처리 중으로 바꿔 탈퇴 작업이 이어받음 */
  @Patch('withdrawal-requests/:requestId')
  @Bind(Req(), Param('requestId'), Body())
  updateWithdrawal(request, requestId, body) {
    const id = idOf(requestId);
    const input = validateBody(body, {
      status: oneOf(['on_hold', 'processing']),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'withdrawal.update',
      payload: { requestId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT * FROM account_withdrawal_requests WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('withdrawal_not_found', '탈퇴 요청을 찾을 수 없음');
        }
        const current = rows[0];
        if (!NEXT_WITHDRAWAL[current.status]?.includes(input.status)) {
          throw conflict(
            'ADMIN_STATE_CONFLICT',
            '지금 상태에서는 할 수 없는 작업이에요.',
          );
        }
        await tx.query(
          `UPDATE account_withdrawal_requests
              SET status = $2, reviewed_by = $3, reviewed_at = now(), reason = $4
            WHERE id = $1`,
          [id, input.status, adminId, input.reason.trim()],
        );
        if (input.status === 'processing' && current.user_id) {
          await tx.query(
            `UPDATE users SET status = 'withdrawal_processing', updated_at = now()
              WHERE id = $1`,
            [current.user_id],
          );
          // 남은 refresh token으로 로그인 상태가 이어지지 않게 모든 세션을 폐기
          await this.sessions.revokeAll(tx, SessionKind.User, current.user_id);
        }
        const updated = await tx.query(`${WITHDRAWAL_SELECT} WHERE w.id = $1`, [
          id,
        ]);
        return {
          result: withdrawalView(updated.rows[0]),
          before: { status: current.status },
          after: { status: input.status },
          targetUserId: current.user_id ?? undefined,
        };
      },
    });
  }
}
