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
import { conflict, notFound } from '../common/errors/http-errors.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  adminPage,
  parseAdminPage,
  pickEnum,
} from '../common/pagination/admin-page.js';
import {
  array,
  boolean,
  idOf,
  oneOf,
  string,
  timestamp,
  uuid,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';
import { NoticeDeliveryService } from '../notices/notice-delivery.service.js';
import { randomUUID } from 'node:crypto';

const CATEGORIES = ['service', 'event', 'policy', 'marketing'];
const STATUSES = ['draft', 'scheduled', 'published', 'cancelled'];
const MAX_RECIPIENTS = 5000;
const STATE_CONFLICT = [
  'ADMIN_STATE_CONFLICT',
  '지금 상태에서는 할 수 없는 작업이에요.',
];

const view = (row, userIds) => ({
  id: row.id,
  category: row.category,
  title: row.title,
  body: row.body,
  linkScreen: row.link_screen,
  audienceType: row.audience_type,
  recipientCount: Number(row.recipient_count),
  // 푸시 발송 결과 집계 (앱 알림함 행의 push_status 기준)
  pushStats: {
    pending: Number(row.push_pending),
    sent: Number(row.push_sent),
    failed: Number(row.push_failed),
    skipped: Number(row.push_skipped),
  },
  ...(userIds ? { userIds } : {}),
  showInList: row.show_in_list,
  sendPush: row.send_push,
  policyDocumentVersionId: row.policy_document_version_id,
  status: row.status,
  scheduledAt: row.scheduled_at,
  publishedAt: row.published_at,
  fanoutCompletedAt: row.fanout_completed_at,
  cancelledAt: row.cancelled_at,
  createdByAdminId: row.created_by_admin_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SELECT = `SELECT n.*,
    (SELECT count(*) FROM notice_recipients r WHERE r.notice_id = n.id) AS recipient_count,
    (SELECT count(*) FROM user_notifications u WHERE u.notice_id = n.id AND u.push_status = 'pending') AS push_pending,
    (SELECT count(*) FROM user_notifications u WHERE u.notice_id = n.id AND u.push_status = 'sent') AS push_sent,
    (SELECT count(*) FROM user_notifications u WHERE u.notice_id = n.id AND u.push_status = 'failed') AS push_failed,
    (SELECT count(*) FROM user_notifications u WHERE u.notice_id = n.id AND u.push_status = 'skipped') AS push_skipped
  FROM notices n`;

const contentRules = (optional) => ({
  category: oneOf(CATEGORIES, { optional }),
  title: string({ min: 1, max: 100, pattern: /\S/, optional }),
  body: string({ min: 1, max: 5000, pattern: /\S/, optional }),
  linkScreen: string({
    min: 1,
    max: 80,
    pattern: /^[a-z][a-z0-9_/.-]*$/,
    optional: true,
  }),
  audienceType: oneOf(['all', 'users'], { optional }),
  userIds: array(uuid(), { min: 1, max: MAX_RECIPIENTS, optional: true }),
  showInList: boolean({ optional }),
  sendPush: boolean({ optional }),
  policyDocumentVersionId: uuid({ optional: true }),
});

/** 합쳐진 공지 내용의 교차 규칙을 DB CHECK 이전에 검사 */
function assertNotice(notice) {
  const errors = [];
  if (!notice.showInList && !notice.sendPush) {
    errors.push('showInList: 목록 노출과 푸시 중 하나는 켜야 함');
  }
  if (notice.category === 'policy' && !notice.policyDocumentVersionId) {
    errors.push('policyDocumentVersionId: 약관 공지에는 필요함');
  }
  if (notice.category !== 'policy' && notice.policyDocumentVersionId) {
    errors.push('policyDocumentVersionId: 약관 공지에서만 쓸 수 있음');
  }
  if (notice.audienceType === 'users' && !notice.userIds?.length) {
    errors.push('userIds: audienceType=users이면 필요함');
  }
  if (notice.audienceType === 'all' && notice.userIds?.length) {
    errors.push('userIds: audienceType=all이면 넣을 수 없음');
  }
  if (errors.length > 0) throw new BadRequestException(errors);
}

/** 관리자 공지 API: 목록·등록·수정(M90~M92), 게시·예약(M93), 취소(M94) */
@Controller('admin/v1/notices')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService, NoticeDeliveryService)
export class AdminNoticesController {
  constructor(database, mutation, delivery) {
    this.database = database;
    this.mutation = mutation;
    this.delivery = delivery;
  }

  /** M90 */
  @Get()
  @Bind(Query())
  async list(query) {
    const status = pickEnum(query, 'status', STATUSES);
    const category = pickEnum(query, 'category', CATEGORIES);
    const paging = parseAdminPage(query, {
      'createdAt,desc': 'n.created_at DESC, n.id DESC',
      'createdAt,asc': 'n.created_at ASC, n.id ASC',
    });
    // sendPush=true: 푸시 알림 메뉴(ADM-33)는 푸시를 보내는 공지만 본다
    const sendPush = pickEnum(query, 'sendPush', ['true', 'false']);
    const params = [
      status ?? null,
      category ?? null,
      sendPush === undefined ? null : sendPush === 'true',
    ];
    const where = `($1::text IS NULL OR n.status = $1)
      AND ($2::text IS NULL OR n.category = $2)
      AND ($3::boolean IS NULL OR n.send_push = $3)`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `${SELECT} WHERE ${where} ORDER BY ${paging.orderBy} LIMIT $4 OFFSET $5`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM notices n WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(
      rows.map((row) => view(row)),
      paging,
      count.rows[0].n,
    );
  }

  /** M91: 항상 초안으로 만듦 */
  @Post()
  @Bind(Req(), Body())
  create(request, body) {
    const input = validateBody(body, {
      ...contentRules(false),
      scheduledAt: timestamp({ optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    assertNotice(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'notice.create',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        await this.assertReferences(tx, input);
        const id = randomUUID();
        await tx.query(
          `INSERT INTO notices
             (id, category, title, body, link_screen, audience_type, show_in_list,
              send_push, policy_document_version_id, scheduled_at,
              created_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            input.category,
            input.title.trim(),
            input.body.trim(),
            input.linkScreen ?? null,
            input.audienceType,
            input.showInList,
            input.sendPush,
            input.policyDocumentVersionId ?? null,
            input.scheduledAt ?? null,
            adminId,
          ],
        );
        if (input.audienceType === 'users') {
          await this.setRecipients(tx, id, input.userIds);
        }
        const result = await this.get(tx, id);
        return { result, after: { id, status: 'draft', title: result.title } };
      },
    });
  }

  /**
   * 게시·예약한 공지의 내용 수정: 받는 회원·목록 노출·푸시·연결 약관은 이미 알림이 나갔으므로 바꾸지 않는다.
   * 관리자 웹 폼은 모든 칸을 함께 보내므로, 그 값이 지금과 같으면 그대로 두고 다르면 거절한다.
   */
  async updatePublishedContent(tx, current, input) {
    const delivery = [
      ['audienceType', current.audience_type],
      ['showInList', current.show_in_list],
      ['sendPush', current.send_push],
      ['policyDocumentVersionId', current.policy_document_version_id],
    ];
    const changed = delivery
      .filter(([key, now]) => input[key] !== undefined && input[key] !== now)
      .map(([key]) => key);
    if (input.userIds !== undefined) changed.push('userIds');
    if (input.scheduledAt !== undefined && current.status === 'published') {
      changed.push('scheduledAt');
    }
    if (changed.length > 0) {
      throw new BadRequestException(
        changed.map(
          (key) =>
            `${key}: 게시·예약한 공지는 내용(분류·제목·본문·이동 화면)만 고칠 수 있음`,
        ),
      );
    }
    const category = input.category ?? current.category;
    if (
      category !== current.category &&
      [category, current.category].includes('policy')
    ) {
      throw new BadRequestException([
        'category: 약관 공지는 게시 뒤 분류를 바꿀 수 없음',
      ]);
    }
    const next = {
      category,
      title: (input.title ?? current.title).trim(),
      body: (input.body ?? current.body).trim(),
      linkScreen:
        input.linkScreen === undefined ? current.link_screen : input.linkScreen,
    };
    await tx.query(
      `UPDATE notices
          SET category = $2, title = $3, body = $4, link_screen = $5,
              scheduled_at = COALESCE($6, scheduled_at), updated_at = now()
        WHERE id = $1`,
      [
        current.id,
        next.category,
        next.title,
        next.body,
        next.linkScreen ?? null,
        current.status === 'scheduled' ? (input.scheduledAt ?? null) : null,
      ],
    );
    return {
      result: await this.get(tx, current.id),
      before: { title: current.title, category: current.category },
      after: { title: next.title, category: next.category },
    };
  }

  /** M92: 초안은 전부, 게시·예약한 공지는 내용만 고칠 수 있음. userIds를 보내면 수신자 전체를 바꿈 */
  @Patch(':noticeId')
  @Bind(Req(), Param('noticeId'), Body())
  update(request, noticeId, body) {
    const id = idOf(noticeId);
    const input = validateBody(body, {
      ...contentRules(true),
      scheduledAt: timestamp({ optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'notice.update',
      payload: { noticeId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const current = await this.lock(tx, id);
        if (current.status === 'cancelled') throw conflict(...STATE_CONFLICT);
        // 게시·예약 뒤에는 내용(분류·제목·본문·이동 화면)만 고친다 (migration 015)
        if (current.status !== 'draft') {
          return this.updatePublishedContent(tx, current, input);
        }
        const { rows: existing } = await tx.query(
          'SELECT user_id FROM notice_recipients WHERE notice_id = $1',
          [id],
        );
        const merged = {
          category: input.category ?? current.category,
          title: (input.title ?? current.title).trim(),
          body: (input.body ?? current.body).trim(),
          linkScreen: input.linkScreen ?? current.link_screen ?? undefined,
          audienceType: input.audienceType ?? current.audience_type,
          showInList: input.showInList ?? current.show_in_list,
          sendPush: input.sendPush ?? current.send_push,
          policyDocumentVersionId:
            input.category && input.category !== 'policy'
              ? undefined
              : (input.policyDocumentVersionId ??
                current.policy_document_version_id ??
                undefined),
          userIds:
            input.audienceType === 'all'
              ? []
              : (input.userIds ?? existing.map((r) => r.user_id)),
          scheduledAt: input.scheduledAt ?? current.scheduled_at ?? undefined,
        };
        assertNotice(merged);
        await this.assertReferences(tx, merged);
        await tx.query(
          `UPDATE notices
              SET category = $2, title = $3, body = $4, link_screen = $5,
                  audience_type = $6, show_in_list = $7, send_push = $8,
                  policy_document_version_id = $9, scheduled_at = $10,
                  updated_at = now()
            WHERE id = $1`,
          [
            id,
            merged.category,
            merged.title,
            merged.body,
            merged.linkScreen ?? null,
            merged.audienceType,
            merged.showInList,
            merged.sendPush,
            merged.policyDocumentVersionId ?? null,
            merged.scheduledAt ?? null,
          ],
        );
        if (
          input.userIds !== undefined ||
          merged.audienceType !== current.audience_type
        ) {
          await tx.query('DELETE FROM notice_recipients WHERE notice_id = $1', [
            id,
          ]);
          if (merged.audienceType === 'users') {
            await this.setRecipients(tx, id, merged.userIds);
          }
        }
        return {
          result: await this.get(tx, id),
          before: { title: current.title, category: current.category },
          after: { title: merged.title, category: merged.category },
        };
      },
    });
  }

  /**
   * M93: scheduledAt이 null이거나 이미 지난 시각이면 즉시 게시(첫 배치 알림까지), 미래면 예약
   * 생략하면 초안에 적어 둔 예약 시각을 따름, 나머지 알림은 정기 작업이 이어서 만듦
   */
  @Post(':noticeId/publish')
  @HttpCode(200)
  @Bind(Req(), Param('noticeId'), Body())
  publish(request, noticeId, body) {
    const id = idOf(noticeId);
    const raw = body ?? {};
    const input = validateBody(raw, {
      scheduledAt: (value) =>
        value === null ? { value: null } : timestamp({ optional: true })(value),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'notice.publish',
      payload: { noticeId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const current = await this.lock(tx, id);
        if (!['draft', 'scheduled'].includes(current.status)) {
          throw conflict(...STATE_CONFLICT);
        }
        const when =
          input.scheduledAt === undefined
            ? current.scheduled_at
            : input.scheduledAt;
        const immediate = when === null || new Date(when) <= new Date();
        if (immediate) {
          await tx.query(
            `UPDATE notices
                SET status = 'published', published_at = now(),
                    scheduled_at = $2, updated_at = now()
              WHERE id = $1`,
            [id, current.status === 'scheduled' ? current.scheduled_at : when],
          );
          await this.delivery.fanoutBatch(tx, id);
        } else {
          await tx.query(
            `UPDATE notices SET status = 'scheduled', scheduled_at = $2,
                    updated_at = now()
              WHERE id = $1`,
            [id, when],
          );
        }
        const result = await this.get(tx, id);
        return {
          result,
          before: { status: current.status },
          after: { status: result.status, scheduledAt: result.scheduledAt },
        };
      },
    });
  }

  /** M94: 초안·예약만 취소 */
  @Post(':noticeId/cancel')
  @HttpCode(200)
  @Bind(Req(), Param('noticeId'), Body())
  cancel(request, noticeId, body) {
    const id = idOf(noticeId);
    const input = validateBody(body, { reason: string(REASON_RULE_OPTIONS) });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'notice.cancel',
      payload: { noticeId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const current = await this.lock(tx, id);
        if (!['draft', 'scheduled'].includes(current.status)) {
          throw conflict(...STATE_CONFLICT);
        }
        await tx.query(
          `UPDATE notices SET status = 'cancelled', cancelled_at = now(),
                  updated_at = now()
            WHERE id = $1`,
          [id],
        );
        return {
          result: await this.get(tx, id),
          before: { status: current.status },
          after: { status: 'cancelled' },
        };
      },
    });
  }

  async lock(tx, id) {
    const { rows } = await tx.query(
      'SELECT * FROM notices WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (rows.length === 0) {
      throw notFound('notice_not_found', '공지를 찾을 수 없음');
    }
    return rows[0];
  }

  async get(db, id) {
    const { rows } = await db.query(`${SELECT} WHERE n.id = $1`, [id]);
    const { rows: users } = await db.query(
      'SELECT user_id FROM notice_recipients WHERE notice_id = $1 ORDER BY user_id',
      [id],
    );
    return view(
      rows[0],
      rows[0].audience_type === 'users' ? users.map((u) => u.user_id) : null,
    );
  }

  /** 약관 버전·수신 회원이 실제로 있는지 */
  async assertReferences(tx, notice) {
    if (notice.policyDocumentVersionId) {
      const { rows } = await tx.query(
        'SELECT 1 FROM policy_document_versions WHERE id = $1',
        [notice.policyDocumentVersionId],
      );
      if (rows.length === 0) {
        throw new BadRequestException(['policyDocumentVersionId: 없는 약관']);
      }
    }
    if (notice.audienceType === 'users') {
      const unique = [...new Set(notice.userIds)];
      const { rows } = await tx.query(
        'SELECT count(*)::int AS n FROM users WHERE id = ANY($1::uuid[])',
        [unique],
      );
      if (rows[0].n !== unique.length) {
        throw new BadRequestException(['userIds: 없는 회원이 있음']);
      }
    }
  }

  async setRecipients(tx, noticeId, userIds) {
    await tx.query(
      `INSERT INTO notice_recipients (notice_id, user_id)
       SELECT $1, u FROM unnest($2::uuid[]) AS u
       ON CONFLICT DO NOTHING`,
      [noticeId, [...new Set(userIds)]],
    );
  }
}
