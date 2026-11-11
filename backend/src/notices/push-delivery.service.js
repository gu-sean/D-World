import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PUSH_SENDER } from './push/push-sender.js';

const MAX_ATTEMPTS = 5;
const MAX_ERROR_LENGTH = 500;

/**
 * 알림의 푸시 발송 (push_status = 'pending' → sent | skipped | failed)
 * - 활성 기기가 없으면 skipped, 한 기기라도 성공하면 sent
 * - 모두 실패하면 시도 횟수를 올리고 pending으로 두어 다음 주기에 재시도, MAX_ATTEMPTS번째에 failed
 * - 사용할 수 없는 토큰(invalidToken)은 기기를 비활성화
 * - 발송은 트랜잭션 밖에서 하고 결과만 조건부로 기록(작업 잠금으로 한 인스턴스만 실행)
 */
@Injectable()
@Dependencies(DatabaseService, PUSH_SENDER)
export class PushDeliveryService {
  logger = new Logger(PushDeliveryService.name);

  constructor(database, sender) {
    this.database = database;
    this.sender = sender;
  }

  async sendPending({ limit = 100 } = {}) {
    const { rows } = await this.database.query(
      `SELECT n.id, n.user_id, n.title, n.body, n.link_screen, n.push_attempts
         FROM user_notifications n
        WHERE n.push_status = 'pending'
        ORDER BY n.created_at, n.id
        LIMIT $1`,
      [limit],
    );
    const result = { sent: 0, skipped: 0, retried: 0, failed: 0 };
    for (const notification of rows) {
      const outcome = await this.sendOne(notification);
      result[outcome] += 1;
    }
    return result;
  }

  async sendOne(notification) {
    const { rows: devices } = await this.database.query(
      `SELECT id, platform, token FROM push_devices
        WHERE user_id = $1 AND is_active ORDER BY last_seen_at DESC`,
      [notification.user_id],
    );
    if (devices.length === 0) {
      await this.mark(notification.id, "push_status = 'skipped'");
      return 'skipped';
    }

    let delivered = false;
    let lastError = null;
    for (const device of devices) {
      try {
        await this.sender.send({
          token: device.token,
          platform: device.platform,
          title: notification.title,
          body: notification.body,
          linkScreen: notification.link_screen,
        });
        delivered = true;
      } catch (error) {
        lastError = error;
        if (error?.invalidToken) {
          await this.database.query(
            'UPDATE push_devices SET is_active = false WHERE id = $1',
            [device.id],
          );
        }
      }
    }

    if (delivered) {
      await this.mark(
        notification.id,
        "push_status = 'sent', push_sent_at = now(), push_attempts = push_attempts + 1",
      );
      return 'sent';
    }
    const attempts = notification.push_attempts + 1;
    const message = String(lastError?.message ?? lastError).slice(
      0,
      MAX_ERROR_LENGTH,
    );
    this.logger.warn(`푸시 실패(${attempts}/${MAX_ATTEMPTS}): ${message}`);
    const giveUp = attempts >= MAX_ATTEMPTS;
    await this.database.query(
      `UPDATE user_notifications
          SET push_attempts = $2, push_last_error = $3,
              push_status = CASE WHEN $4 THEN 'failed' ELSE push_status END
        WHERE id = $1 AND push_status = 'pending'`,
      [notification.id, attempts, message, giveUp],
    );
    return giveUp ? 'failed' : 'retried';
  }

  /** 아직 pending인 알림만 갱신(다른 곳에서 이미 처리했으면 건너뜀) */
  mark(id, assignments) {
    return this.database.query(
      `UPDATE user_notifications SET ${assignments}
        WHERE id = $1 AND push_status = 'pending'`,
      [id],
    );
  }
}
