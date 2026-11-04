import { Dependencies, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
@Dependencies(DatabaseService)
export class RestrictionService {
  constructor(database) {
    this.database = database;
  }

  /** 진행 중인 이용 제한(경고는 해당 없음), 없으면 null */
  async activeRestriction(userId, db = this.database) {
    const { rows } = await db.query(
      `SELECT id, ends_at
         FROM account_actions
        WHERE user_id = $1
          AND action_type = 'restriction'
          AND starts_at <= now()
          AND ends_at > now()
          AND lifted_at IS NULL
        ORDER BY ends_at DESC
        LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
  }
}
