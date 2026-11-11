import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  adminPage,
  parseAdminPage,
  pickEnum,
} from '../common/pagination/admin-page.js';
import {
  idOf,
  integer,
  object,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import {
  accountActionView,
  AdminMembersService,
  REASON_RULE_OPTIONS,
} from './admin-members.service.js';

const STATE_CONFLICT = [
  'ADMIN_STATE_CONFLICT',
  '지금 상태에서는 할 수 없는 작업이에요.',
];

const listItemView = (row) => ({
  id: row.id,
  ticketType: row.ticket_type,
  category: row.category,
  subject: row.subject,
  status: row.status,
  targetKind: row.target_kind,
  assignedAdminId: row.assigned_admin_id,
  receivedAt: row.received_at,
  completedAt: row.completed_at,
});

const eventView = (row) => ({
  id: row.id,
  eventType: row.event_type,
  visibility: row.visibility,
  adminId: row.admin_id,
  body: row.body,
  createdAt: row.created_at,
});

/** 티켓 응답용 대상 이름: 대상 행이 지워졌으면 null */
const TARGET_LABEL = `COALESCE(
  (SELECT nickname FROM profiles WHERE user_id = t.target_user_id),
  (SELECT title FROM mission_definitions WHERE id = t.target_mission_definition_id),
  (SELECT title FROM challenges WHERE id = t.target_challenge_id))`;

/** 관리자 문의·신고 API: 목록·상세(M20·M21), 담당 지정(M22), 답변·메모(M23), 처리 완료(M24) */
@Controller('admin/v1/support-tickets')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService, AdminMembersService)
export class AdminSupportController {
  constructor(database, mutation, members) {
    this.database = database;
    this.mutation = mutation;
    this.members = members;
  }

  /** M20 */
  @Get()
  @Bind(Req(), Query())
  async list(request, query) {
    const ticketType = pickEnum(query, 'ticketType', ['inquiry', 'report']);
    const status = pickEnum(query, 'status', [
      'received',
      'in_review',
      'completed',
    ]);
    const targetKind = pickEnum(query, 'targetKind', [
      'user',
      'mission_definition',
      'challenge',
    ]);
    const assigned = pickEnum(query, 'assigned', ['me', 'none']);
    const paging = parseAdminPage(query, {
      'receivedAt,asc': 't.received_at ASC, t.id ASC',
      'receivedAt,desc': 't.received_at DESC, t.id DESC',
    });
    const params = [
      ticketType ?? null,
      status ?? null,
      targetKind ?? null,
      assigned ?? null,
      request.auth.adminId,
    ];
    const where = `($1::text IS NULL OR t.ticket_type = $1)
      AND ($2::text IS NULL OR t.status = $2)
      AND ($3::text IS NULL OR t.target_kind = $3)
      AND ($4::text IS NULL
           OR ($4 = 'me' AND t.assigned_admin_id = $5)
           OR ($4 = 'none' AND t.assigned_admin_id IS NULL))`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT t.* FROM support_tickets t WHERE ${where}
          ORDER BY ${paging.orderBy} LIMIT $6 OFFSET $7`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM support_tickets t WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(rows.map(listItemView), paging, count.rows[0].n);
  }

  /** M21 */
  @Get(':ticketId')
  @Bind(Param('ticketId'))
  async get(ticketId) {
    return this.detail(this.database, idOf(ticketId));
  }

  /** M22: adminId가 null이면 요청한 관리자 본인 */
  @Post(':ticketId/assign')
  @HttpCode(200)
  @Bind(Req(), Param('ticketId'), Body())
  assign(request, ticketId, body) {
    const id = idOf(ticketId);
    const input = validateBody(body, {
      adminId: nullableUuid(),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    const assignee = input.adminId ?? adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'ticket.assign',
      payload: { ticketId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const ticket = await this.lockTicket(tx, id);
        if (ticket.status === 'completed') throw conflict(...STATE_CONFLICT);
        const target = await tx.query(
          "SELECT 1 FROM admin_accounts WHERE id = $1 AND status = 'active'",
          [assignee],
        );
        if (target.rows.length === 0) {
          throw notFound('admin_not_found', '담당할 관리자를 찾을 수 없음');
        }
        await tx.query(
          `UPDATE support_tickets
              SET assigned_admin_id = $2,
                  status = CASE WHEN status = 'received'
                                THEN 'in_review' ELSE status END
            WHERE id = $1`,
          [id, assignee],
        );
        await this.addEvent(tx, id, adminId, 'assigned', 'internal', null);
        if (ticket.status === 'received') {
          await this.addEvent(
            tx,
            id,
            adminId,
            'status_changed',
            'internal',
            null,
          );
        }
        return {
          result: await this.detail(tx, id),
          before: { assignedAdminId: ticket.assigned_admin_id },
          after: { assignedAdminId: assignee },
        };
      },
    });
  }

  /** M23: reply는 회원에게 보이고 알림, note는 내부 메모 */
  @Post(':ticketId/events')
  @Bind(Req(), Param('ticketId'), Body())
  addNote(request, ticketId, body) {
    const id = idOf(ticketId);
    const input = validateBody(body, {
      eventType: oneOf(['reply', 'note']),
      body: string({
        min: 1,
        max: 2000,
        pattern: /\S/,
        patternMessage: '공백만 입력할 수 없음',
      }),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: `ticket.${input.eventType}`,
      payload: { ticketId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const ticket = await this.lockTicket(tx, id);
        if (ticket.status === 'completed') throw conflict(...STATE_CONFLICT);
        const eventId = await this.addEvent(
          tx,
          id,
          adminId,
          input.eventType,
          input.eventType === 'reply' ? 'user' : 'internal',
          input.body,
        );
        if (input.eventType === 'reply') {
          await this.notifyReporter(tx, ticket, eventId);
        }
        return { result: await this.detail(tx, id) };
      },
    });
  }

  /** M24: outcome과 accountAction·contentAction·userReply 조합을 검사한 뒤 한 트랜잭션으로 처리 */
  @Post(':ticketId/resolution')
  @HttpCode(200)
  @Bind(Req(), Param('ticketId'), Body())
  resolve(request, ticketId, body) {
    const id = idOf(ticketId);
    const input = validateBody(body, {
      outcome: oneOf([
        'no_action',
        'reply_only',
        'account_action',
        'content_action',
        'both',
      ]),
      userReply: string({ min: 1, max: 2000, pattern: /\S/, optional: true }),
      accountAction: object(
        {
          actionType: oneOf(['warning', 'restriction']),
          days: integer({ min: 1, max: 365, optional: true }),
        },
        { optional: true },
      ),
      contentAction: oneOf(['hidden', 'deleted'], { optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    assertOutcomeShape(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'ticket.resolve',
      payload: { ticketId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const ticket = await this.lockTicket(tx, id);
        if (ticket.status === 'completed') throw conflict(...STATE_CONFLICT);
        this.assertTargets(ticket, input);
        if (ticket.status === 'received') {
          await tx.query(
            `UPDATE support_tickets SET status = 'in_review', assigned_admin_id = $2
              WHERE id = $1`,
            [id, adminId],
          );
          await this.addEvent(
            tx,
            id,
            adminId,
            'status_changed',
            'internal',
            null,
          );
        }
        let actionId = null;
        if (input.accountAction) {
          const action = await this.members.createAccountAction(tx, {
            adminId,
            userId: ticket.target_user_id,
            actionType: input.accountAction.actionType,
            days: input.accountAction.days,
            reason: input.reason.trim(),
            sourceTicketId: id,
          });
          actionId = action.id;
        }
        if (input.contentAction) {
          await this.applyContentAction(tx, ticket, input.contentAction);
        }
        await tx.query(
          `INSERT INTO support_ticket_resolutions
             (ticket_id, ticket_type, outcome, user_reply, account_action_id,
              content_action, resolved_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            ticket.ticket_type,
            input.outcome,
            input.userReply ?? null,
            actionId,
            input.contentAction ?? null,
            adminId,
          ],
        );
        await tx.query(
          `UPDATE support_tickets SET status = 'completed', completed_at = now()
            WHERE id = $1`,
          [id],
        );
        await this.addEvent(
          tx,
          id,
          adminId,
          'status_changed',
          'internal',
          null,
        );
        if (input.userReply) {
          const replyId = await this.addEvent(
            tx,
            id,
            adminId,
            'reply',
            'user',
            input.userReply,
          );
          await this.notifyReporter(tx, ticket, replyId);
        }
        return {
          result: await this.detail(tx, id),
          before: { status: ticket.status },
          after: { status: 'completed', outcome: input.outcome },
          targetUserId: ticket.target_user_id ?? undefined,
        };
      },
    });
  }

  async lockTicket(tx, id) {
    const { rows } = await tx.query(
      'SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (rows.length === 0) {
      throw notFound('ticket_not_found', '문의·신고를 찾을 수 없음');
    }
    return rows[0];
  }

  async addEvent(tx, ticketId, adminId, eventType, visibility, body) {
    const id = randomUUID();
    await tx.query(
      `INSERT INTO support_ticket_events
         (id, ticket_id, admin_id, event_type, visibility, body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())`,
      [id, ticketId, adminId, eventType, visibility, body],
    );
    return id;
  }

  /** 답변 알림은 신고자·문의자에게만, 신고 대상자에게는 신고자 정보를 알리지 않음 */
  async notifyReporter(tx, ticket, eventId) {
    if (!ticket.reporter_user_id) return;
    await tx.query(
      `INSERT INTO user_notifications (id, user_id, kind, event_key, title, body)
       VALUES ($1, $2, 'system', $3, $4, $5)`,
      [
        randomUUID(),
        ticket.reporter_user_id,
        `ticket_reply:${eventId}`,
        ticket.ticket_type === 'report'
          ? '신고 처리 결과 안내'
          : '문의 답변이 도착했어요',
        '앱에서 답변을 확인해 주세요.',
      ],
    );
  }

  assertTargets(ticket, input) {
    if (input.accountAction && !ticket.target_user_id) {
      throw new BadRequestException([
        'accountAction: 회원 신고에서만 할 수 있음',
      ]);
    }
    if (
      input.contentAction &&
      !['mission_definition', 'challenge'].includes(ticket.target_kind)
    ) {
      throw new BadRequestException([
        'contentAction: 미션 틀·챌린지 신고에서만 할 수 있음',
      ]);
    }
    if (input.outcome !== 'reply_only' && ticket.ticket_type !== 'report') {
      throw new BadRequestException(['outcome: 문의는 reply_only만 가능함']);
    }
  }

  /** 미션 틀은 hidden(deleted면 deleted_at도), 챌린지는 삭제도 숨김으로 처리 */
  async applyContentAction(tx, ticket, action) {
    if (ticket.target_kind === 'mission_definition') {
      if (!ticket.target_mission_definition_id) {
        throw notFound('target_not_found', '신고 대상이 이미 없음');
      }
      await tx.query(
        `UPDATE mission_definitions
            SET publication_status = 'hidden',
                deleted_at = CASE WHEN $2 = 'deleted'
                                  THEN COALESCE(deleted_at, now()) ELSE deleted_at END,
                updated_at = now()
          WHERE id = $1`,
        [ticket.target_mission_definition_id, action],
      );
    } else {
      if (!ticket.target_challenge_id) {
        throw notFound('target_not_found', '신고 대상이 이미 없음');
      }
      await tx.query(
        `UPDATE challenges SET publication_status = 'hidden'
          WHERE id = $1`,
        [ticket.target_challenge_id],
      );
    }
  }

  async detail(db, id) {
    const { rows } = await db.query(
      `SELECT t.*, ${TARGET_LABEL} AS target_label,
              rp.nickname AS reporter_nickname,
              aa.login_id AS assigned_login_id
         FROM support_tickets t
         LEFT JOIN profiles rp ON rp.user_id = t.reporter_user_id
         LEFT JOIN admin_accounts aa ON aa.id = t.assigned_admin_id
        WHERE t.id = $1`,
      [id],
    );
    if (rows.length === 0) {
      throw notFound('ticket_not_found', '문의·신고를 찾을 수 없음');
    }
    const [events, resolution] = await Promise.all([
      db.query(
        `SELECT * FROM support_ticket_events WHERE ticket_id = $1
          ORDER BY created_at, id`,
        [id],
      ),
      db.query(
        `SELECT r.*, a.* FROM support_ticket_resolutions r
           LEFT JOIN account_actions a ON a.id = r.account_action_id
          WHERE r.ticket_id = $1`,
        [id],
      ),
    ]);
    const row = rows[0];
    const done = resolution.rows[0];
    return {
      ...listItemView(row),
      body: row.body,
      reporterUserId: row.reporter_user_id,
      reporterNickname: row.reporter_nickname ?? null,
      assignedAdminLoginId: row.assigned_login_id ?? null,
      target: row.target_kind
        ? {
            kind: row.target_kind,
            id:
              row.target_user_id ??
              row.target_mission_definition_id ??
              row.target_challenge_id,
            label: row.target_label ?? null,
          }
        : null,
      events: events.rows.map(eventView),
      resolution: done
        ? {
            outcome: done.outcome,
            userReply: done.user_reply,
            contentAction: done.content_action,
            accountAction: done.account_action_id
              ? accountActionView({ ...done, id: done.account_action_id })
              : null,
            resolvedByAdminId: done.resolved_by_admin_id,
            resolvedAt: done.resolved_at,
          }
        : null,
    };
  }
}

/** outcome별 필수·금지 필드 (09 M24: 불일치는 COMMON_VALIDATION_FAILED) */
function assertOutcomeShape({
  outcome,
  userReply,
  accountAction,
  contentAction,
}) {
  const errors = [];
  const needs = {
    reply_only: { userReply: true, accountAction: false, contentAction: false },
    no_action: { accountAction: false, contentAction: false },
    account_action: { accountAction: true, contentAction: false },
    content_action: { accountAction: false, contentAction: true },
    both: { accountAction: true, contentAction: true },
  }[outcome];
  const given = {
    userReply: userReply !== undefined,
    accountAction: accountAction !== undefined,
    contentAction: contentAction !== undefined,
  };
  for (const [field, required] of Object.entries(needs)) {
    if (given[field] !== required) {
      errors.push(
        `${field}: outcome=${outcome}일 때 ${required ? '필요함' : '넣을 수 없음'}`,
      );
    }
  }
  if (
    accountAction &&
    (accountAction.actionType === 'restriction') !==
      (accountAction.days !== undefined)
  ) {
    errors.push('accountAction.days: 이용 제한일 때만 필요함');
  }
  if (errors.length > 0) throw new BadRequestException(errors);
}

/** null을 허용하는 uuid 규칙: null이면 요청한 관리자 본인 */
function nullableUuid() {
  const rule = uuid();
  return (raw) => (raw === null ? { value: null } : rule(raw));
}
