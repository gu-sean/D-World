import { newId } from '../common/ids.js';
import {
  BadRequestException,
  Dependencies,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor.js';
import { DatabaseService } from '../database/database.service.js';

export const INQUIRY_CATEGORIES = [
  'account',
  'mission',
  'verification',
  'points',
  'challenge',
  'other',
];
export const REPORT_CATEGORIES = [
  'abuse',
  'inappropriate_content',
  'cheating',
  'impersonation',
  'other',
];
// 처리가 끝나지 않은 접수 수 상한(관리자 큐를 한 회원이 채우지 못하게)
const MAX_OPEN_TICKETS = 20;
const TARGET_COLUMN = {
  user: 'target_user_id',
  mission_definition: 'target_mission_definition_id',
  challenge: 'target_challenge_id',
};

const listItemView = (row) => ({
  id: row.id,
  ticketType: row.ticket_type,
  category: row.category,
  subject: row.subject,
  status: row.status,
  targetKind: row.target_kind,
  receivedAt: row.received_at,
  completedAt: row.completed_at,
});

/** 문의·신고 접수와 내 접수 내역 조회 (처리는 관리자 M20~M24) */
@Injectable()
@Dependencies(DatabaseService)
export class UserSupportService {
  constructor(database) {
    this.database = database;
  }

  /** 접수: 문의는 대상 없음, 신고는 회원·미션 틀·챌린지 중 하나가 대상 */
  async createTicket(userId, input) {
    const { ticketType, category, subject, body, target } = input;
    const categories =
      ticketType === 'inquiry' ? INQUIRY_CATEGORIES : REPORT_CATEGORIES;
    const errors = [];
    if (!categories.includes(category)) {
      errors.push(`category: ${categories.join(' | ')} 중 하나여야 함`);
    }
    if (ticketType === 'inquiry' && target) {
      errors.push('target: 문의에는 넣을 수 없음');
    }
    if (ticketType === 'report' && !target) {
      errors.push('target: 신고에는 필요함');
    }
    if (errors.length > 0) throw new BadRequestException(errors);

    return this.database.withTransaction(async (tx) => {
      // 같은 회원의 동시 접수가 상한을 함께 넘지 않도록 회원 행을 잠금
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const { rows: open } = await tx.query(
        `SELECT count(*)::int AS n FROM support_tickets
          WHERE reporter_user_id = $1 AND status <> 'completed'`,
        [userId],
      );
      if (open[0].n >= MAX_OPEN_TICKETS) {
        throw new AppException(
          HttpStatus.TOO_MANY_REQUESTS,
          'too_many_requests',
          '처리 중인 문의·신고가 너무 많음',
          { details: { limit: MAX_OPEN_TICKETS } },
        );
      }
      if (target) await this.assertReportable(tx, userId, target);
      const id = newId();
      await tx.query(
        `INSERT INTO support_tickets
           (id, ticket_type, category, reporter_user_id, subject, body,
            target_kind, ${target ? TARGET_COLUMN[target.kind] : 'target_user_id'})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          ticketType,
          category,
          userId,
          subject.trim(),
          body.trim(),
          target?.kind ?? null,
          target?.id ?? null,
        ],
      );
      await tx.query(
        `INSERT INTO support_ticket_events (id, ticket_id, event_type, visibility)
         VALUES ($1, $2, 'received', 'user')`,
        [newId(), id],
      );
      return this.getTicket(userId, id, tx);
    });
  }

  /** 대상이 있고, 내가 아니고, 같은 대상에 대한 미완료 신고가 없어야 함 */
  async assertReportable(tx, userId, target) {
    const checks = {
      user: 'SELECT id FROM users WHERE id = $1',
      mission_definition:
        'SELECT id FROM mission_definitions WHERE id = $1 AND deleted_at IS NULL',
      challenge: 'SELECT id FROM challenges WHERE id = $1',
    };
    const { rows } = await tx.query(checks[target.kind], [target.id]);
    if (rows.length === 0) {
      throw notFound('target_not_found', '신고할 대상을 찾을 수 없음');
    }
    if (target.kind === 'user' && target.id === userId) {
      throw new BadRequestException(['target: 나를 신고할 수 없음']);
    }
    const { rows: open } = await tx.query(
      `SELECT 1 FROM support_tickets
        WHERE ticket_type = 'report' AND status <> 'completed'
          AND reporter_user_id = $1 AND ${TARGET_COLUMN[target.kind]} = $2`,
      [userId, target.id],
    );
    if (open.length > 0) {
      throw conflict('already_reported', '이미 처리 중인 신고가 있어요.');
    }
  }

  async listTickets(userId, { limit, cursor, ticketType, status }) {
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `SELECT *, received_at::text AS received_at_raw FROM support_tickets
        WHERE reporter_user_id = $1
          AND ($2::text IS NULL OR ticket_type = $2)
          AND ($3::text IS NULL OR status = $3)
          AND ($4::timestamptz IS NULL
               OR (received_at, id) < ($4::timestamptz, $5::short_id))
        ORDER BY received_at DESC, id DESC
        LIMIT $6`,
      [
        userId,
        ticketType ?? null,
        status ?? null,
        after.t,
        after.id,
        limit + 1,
      ],
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map(listItemView),
      nextCursor:
        rows.length > limit
          ? encodeCursor(page[page.length - 1], 'received_at_raw')
          : null,
    };
  }

  /**
   * 상세: 회원에게 보이는 이벤트(접수·답변)만, 내부 메모·담당자·처리한 조치 내용은 숨김
   */
  async getTicket(userId, ticketId, db = this.database) {
    const { rows } = await db.query(
      `SELECT * FROM support_tickets WHERE id = $1 AND reporter_user_id = $2`,
      [ticketId, userId],
    );
    if (rows.length === 0) {
      throw notFound('ticket_not_found', '문의·신고를 찾을 수 없음');
    }
    const [events, resolution] = await Promise.all([
      db.query(
        `SELECT id, event_type, body, created_at FROM support_ticket_events
          WHERE ticket_id = $1 AND visibility = 'user'
          ORDER BY created_at, id`,
        [ticketId],
      ),
      db.query(
        `SELECT user_reply, resolved_at FROM support_ticket_resolutions
          WHERE ticket_id = $1`,
        [ticketId],
      ),
    ]);
    const done = resolution.rows[0];
    return {
      ...listItemView(rows[0]),
      body: rows[0].body,
      events: events.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        body: row.body,
        createdAt: row.created_at,
      })),
      // 07 SupportTicketDetail.replies: 회원에게 보이는 답변만 (앱 문의 상세가 이 키를 읽는다)
      replies: events.rows
        .filter((row) => row.event_type === 'reply' && row.body)
        .map((row) => ({ body: row.body, createdAt: row.created_at })),
      resolution: done
        ? { userReply: done.user_reply, resolvedAt: done.resolved_at }
        : null,
    };
  }
}
