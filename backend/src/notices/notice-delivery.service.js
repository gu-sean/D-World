import { Dependencies, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

const FANOUT_BATCH = 1000;

/**
 * 공지 게시와 회원별 알림 생성 (팀 문서 11 §3.7)
 * - 예약 시각이 지난 공지를 게시하고, 게시된 공지의 수신자별 알림을 배치로 만든다
 * - 알림은 (회원, 공지) 고유 키로 중복이 막혀 여러 번 실행해도 안전하고, 이어서 처리할 수 있다
 * - marketing 공지는 마케팅 수신에 동의한 회원에게만, 푸시는 알림을 켠 회원만 pending으로 둔다
 *   (실제 푸시 발송은 별도 작업)
 */
@Injectable()
@Dependencies(DatabaseService)
export class NoticeDeliveryService {
  constructor(database) {
    this.database = database;
  }

  /**
   * 게시된 공지 하나의 알림을 한 배치 만들고, 대상이 더 없으면 완료 시각을 기록
   * 호출자가 공지 행을 잠근 트랜잭션(tx) 안에서 부름
   * afterUserId를 주면 그 뒤 회원부터 봄(앞쪽 회원을 매번 다시 훑지 않도록, 반환한 lastUserId를 이어서 사용)
   */
  async fanoutBatch(
    tx,
    noticeId,
    { limit = FANOUT_BATCH, afterUserId = null } = {},
  ) {
    const { rows } = await tx.query(
      `WITH n AS (SELECT * FROM notices WHERE id = $1 AND status = 'published'),
            batch AS (
              SELECT u.id AS user_id, p.notification_enabled
                FROM n
                JOIN users u ON u.status = 'active'
                LEFT JOIN profiles p ON p.user_id = u.id
               WHERE ($3::uuid IS NULL OR u.id > $3)
                 AND (n.audience_type = 'all' OR EXISTS (
                        SELECT 1 FROM notice_recipients r
                         WHERE r.notice_id = n.id AND r.user_id = u.id))
                 AND (n.category <> 'marketing' OR COALESCE((
                        SELECT c.granted FROM consent_records c
                          JOIN policy_document_versions d
                            ON d.id = c.document_version_id
                         WHERE c.user_id = u.id AND d.document_type = 'marketing'
                         ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1), false))
                 AND NOT EXISTS (
                        SELECT 1 FROM user_notifications x
                         WHERE x.user_id = u.id AND x.notice_id = n.id)
               ORDER BY u.id
               LIMIT $2),
            ins AS (
              INSERT INTO user_notifications
                (id, user_id, kind, notice_id, title, body, link_screen, push_status)
              SELECT gen_random_uuid(), b.user_id, 'notice', n.id, n.title, n.body,
                     n.link_screen,
                     CASE WHEN NOT n.send_push THEN 'none'
                          WHEN COALESCE(b.notification_enabled, false) THEN 'pending'
                          ELSE 'skipped' END
                FROM batch b CROSS JOIN n
              ON CONFLICT DO NOTHING
              RETURNING 1)
       SELECT (SELECT count(*) FROM batch)::int AS picked,
              (SELECT user_id FROM batch ORDER BY user_id DESC LIMIT 1) AS last_user_id`,
      [noticeId, limit, afterUserId],
    );
    const picked = rows[0].picked;
    const completed = picked < limit;
    if (completed) {
      await tx.query(
        `UPDATE notices SET fanout_completed_at = now()
          WHERE id = $1 AND fanout_completed_at IS NULL`,
        [noticeId],
      );
    }
    return { picked, completed, lastUserId: rows[0].last_user_id };
  }

  /** 예약 시각이 지난 공지 게시 + 알림이 덜 만들어진 공지 이어서 처리, 정기 작업이 부름 */
  async deliverDue({ noticeLimit = 10, budgetMs = 20_000 } = {}) {
    let published = 0;
    let fannedOut = 0;
    await this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `UPDATE notices SET status = 'published', published_at = now()
          WHERE id IN (
            SELECT id FROM notices
             WHERE status = 'scheduled' AND scheduled_at <= now()
             ORDER BY scheduled_at LIMIT $1 FOR UPDATE SKIP LOCKED)
          RETURNING id`,
        [noticeLimit],
      );
      published = rows.length;
    });
    const { rows: pending } = await this.database.query(
      `SELECT id FROM notices
        WHERE status = 'published' AND fanout_completed_at IS NULL
        ORDER BY published_at LIMIT $1`,
      [noticeLimit],
    );
    const deadline = Date.now() + budgetMs;
    for (const { id } of pending) {
      let cursor = null;
      let done = false;
      while (!done && Date.now() < deadline) {
        done = await this.database.withTransaction(async (tx) => {
          const { rows } = await tx.query(
            `SELECT id FROM notices
              WHERE id = $1 AND status = 'published'
                AND fanout_completed_at IS NULL
                FOR UPDATE SKIP LOCKED`,
            [id],
          );
          if (rows.length === 0) return true;
          const batch = await this.fanoutBatch(tx, id, {
            afterUserId: cursor,
          });
          cursor = batch.lastUserId ?? cursor;
          return batch.completed;
        });
      }
      if (done) fannedOut += 1;
    }
    return { published, fannedOut };
  }
}
