import { newId } from '../common/ids.js';
import { Dependencies, Injectable } from '@nestjs/common';
import { notFound } from '../common/errors/http-errors.js';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor.js';
import { DatabaseService } from '../database/database.service.js';

const notificationView = (row) => ({
  id: row.id,
  kind: row.kind,
  noticeId: row.notice_id,
  noticeCategory: row.category ?? null,
  title: row.title,
  body: row.body,
  linkScreen: row.link_screen,
  createdAt: row.created_at,
  readAt: row.read_at,
});

const deviceView = (row) => ({
  id: row.id,
  platform: row.platform,
  isActive: row.is_active,
  registeredAt: row.registered_at,
  lastSeenAt: row.last_seen_at,
});

// 푸시 전용 공지(show_in_list = false)는 알림함에 보이지 않음
const VISIBLE = "(n.kind = 'system' OR nt.show_in_list)";

/** 알림함(조회·읽음)·푸시 기기 등록·공지 조회 */
@Injectable()
@Dependencies(DatabaseService)
export class UserNotificationsService {
  constructor(database) {
    this.database = database;
  }

  /** 알림 목록: 최신순 커서, unreadOnly면 안 읽은 것만 */
  async listNotifications(userId, { limit, cursor, unreadOnly }) {
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `SELECT n.id, n.kind, n.notice_id, n.title, n.body, n.link_screen,
              n.created_at, n.created_at::text AS created_at_raw, n.read_at,
              nt.category
         FROM user_notifications n
         LEFT JOIN notices nt ON nt.id = n.notice_id
        WHERE n.user_id = $1 AND ${VISIBLE}
          AND ($2::boolean IS NOT TRUE OR n.read_at IS NULL)
          AND ($3::timestamptz IS NULL
               OR (n.created_at, n.id) < ($3::timestamptz, $4::short_id))
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT $5`,
      [userId, unreadOnly, after.t, after.id, limit + 1],
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map(notificationView),
      nextCursor:
        rows.length > limit
          ? encodeCursor(page[page.length - 1], 'created_at_raw')
          : null,
    };
  }

  async unreadCount(userId) {
    const { rows } = await this.database.query(
      `SELECT count(*)::int AS count
         FROM user_notifications n
         LEFT JOIN notices nt ON nt.id = n.notice_id
        WHERE n.user_id = $1 AND n.read_at IS NULL AND ${VISIBLE}`,
      [userId],
    );
    return { count: rows[0].count };
  }

  /** 읽음 처리: 이미 읽었으면 그대로(읽은 시각은 처음 한 번만 기록) */
  async markRead(userId, notificationId) {
    await this.database.query(
      `UPDATE user_notifications SET read_at = now()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [notificationId, userId],
    );
    const { rows } = await this.database.query(
      `SELECT n.id, n.kind, n.notice_id, n.title, n.body, n.link_screen,
              n.created_at, n.read_at, nt.category
         FROM user_notifications n
         LEFT JOIN notices nt ON nt.id = n.notice_id
        WHERE n.id = $1 AND n.user_id = $2 AND ${VISIBLE}`,
      [notificationId, userId],
    );
    if (rows.length === 0) {
      throw notFound('notification_not_found', '알림을 찾을 수 없음');
    }
    return notificationView(rows[0]);
  }

  async markAllRead(userId) {
    const { rowCount } = await this.database.query(
      `UPDATE user_notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return { updated: rowCount };
  }

  /**
   * 푸시 기기 등록(같은 토큰을 다시 보내면 갱신): 토큰이 다른 회원에게 묶여 있으면
   * 기기를 넘겨받은 것으로 보고 지금 회원으로 옮김
   */
  async registerDevice(userId, { platform, token }) {
    const { rows } = await this.database.query(
      `INSERT INTO push_devices (id, user_id, platform, token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE
          SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
              is_active = true, last_seen_at = now()
       RETURNING *`,
      [newId(), userId, platform, token],
    );
    return deviceView(rows[0]);
  }

  /** A16: 토큰으로 기기를 끔, 없거나 이미 꺼졌어도 성공(로그아웃은 항상 성공해야 함) */
  async unregisterByToken(userId, token) {
    await this.database.query(
      `UPDATE push_devices SET is_active = false
        WHERE token = $1 AND user_id = $2`,
      [token, userId],
    );
  }

  /** 로그아웃·알림 해제 때 기기를 끔(내 기기만) */
  async deactivateDevice(userId, deviceId) {
    const { rowCount } = await this.database.query(
      `UPDATE push_devices SET is_active = false
        WHERE id = $1 AND user_id = $2`,
      [deviceId, userId],
    );
    if (rowCount === 0) {
      throw notFound('device_not_found', '기기를 찾을 수 없음');
    }
  }

  /**
   * 공지 조회 조건: 게시됨 + 목록 노출 + (전체 대상이거나 수신자)
   * 마케팅 공지는 마케팅 수신 동의자에게만 보임
   */
  visibleNotices(userParam) {
    return `n.status = 'published' AND n.show_in_list
      AND (n.audience_type = 'all' OR EXISTS (
             SELECT 1 FROM notice_recipients r
              WHERE r.notice_id = n.id AND r.user_id = ${userParam}))
      AND (n.category <> 'marketing' OR COALESCE((
             SELECT c.granted FROM consent_records c
               JOIN policy_document_versions d ON d.id = c.document_version_id
              WHERE c.user_id = ${userParam} AND d.document_type = 'marketing'
              ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1), false))`;
  }

  async listNotices(userId, { limit, cursor }) {
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `SELECT n.id, n.category, n.title, n.body, n.link_screen, n.published_at,
              n.published_at::text AS published_at_raw
         FROM notices n
        WHERE ${this.visibleNotices('$1')}
          AND ($2::timestamptz IS NULL
               OR (n.published_at, n.id) < ($2::timestamptz, $3::short_id))
        ORDER BY n.published_at DESC, n.id DESC
        LIMIT $4`,
      [userId, after.t, after.id, limit + 1],
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({
        id: row.id,
        category: row.category,
        title: row.title,
        body: row.body,
        linkScreen: row.link_screen,
        publishedAt: row.published_at,
      })),
      nextCursor:
        rows.length > limit
          ? encodeCursor(page[page.length - 1], 'published_at_raw')
          : null,
    };
  }

  async getNotice(userId, noticeId) {
    const { rows } = await this.database.query(
      `SELECT n.id, n.category, n.title, n.body, n.link_screen, n.published_at,
              n.policy_document_version_id
         FROM notices n
        WHERE n.id = $2 AND ${this.visibleNotices('$1')}`,
      [userId, noticeId],
    );
    if (rows.length === 0) {
      throw notFound('notice_not_found', '공지를 찾을 수 없음');
    }
    const row = rows[0];
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      linkScreen: row.link_screen,
      publishedAt: row.published_at,
      policyDocumentVersionId: row.policy_document_version_id,
    };
  }
}
