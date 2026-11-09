import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AchievementsService } from '../achievements/achievements.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';

const num = (value) => Number(value);

const FIXED_TITLES = {
  streak: '연속 달성 보상',
  achievement: '업적 보상',
  challenge: '챌린지 보상',
  admin_adjustment: '관리자 조정',
};

/** 거래 한 건의 사용자용 제목 */
export function transactionTitle({ sourceType, sourceName, availableDelta }) {
  if (sourceType === 'mission') {
    return `${sourceName ?? '미션'} ${availableDelta >= 0 ? '인증 성공' : '보상 회수'}`;
  }
  if (sourceType === 'shop_order') {
    return `${sourceName ?? '상품'} ${availableDelta <= 0 ? '교환' : '환불'}`;
  }
  return FIXED_TITLES[sourceType] ?? '포인트 변동';
}

/** 모바일 클라이언트 보상 조회 API: 인벤토리·포인트 내역·업적 목록 (08 A72·A74·A76, 07 §11·§12) */
@Injectable()
@Dependencies(DatabaseService, AchievementsService)
export class MobileRewardsService {
  constructor(database, achievements) {
    this.database = database;
    this.achievements = achievements;
  }

  /** A72 InventoryItem[] */
  async inventory(userId) {
    const { rows } = await this.database.query(
      `SELECT i.id, i.name, i.item_kind, inv.quantity, inv.updated_at
         FROM user_inventory inv
         JOIN shop_items i ON i.id = inv.item_id
        WHERE inv.user_id = $1 AND inv.quantity > 0
        ORDER BY i.display_order, i.id`,
      [userId],
    );
    return rows.map((row) => ({
      itemId: row.id,
      name: row.name,
      itemKind: row.item_kind,
      quantity: row.quantity,
      acquiredAt: row.updated_at,
    }));
  }

  /** A74 Page<PointTransaction>, direction=earn|spend */
  async pointTransactions(userId, { direction, cursor, limit }) {
    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.t !== 'string' || typeof after.id !== 'string') {
          throw new Error();
        }
      } catch {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'bad_request',
          '잘못된 cursor',
        );
      }
    }
    const { rows } = await this.database.query(
      `SELECT t.id, t.kind, t.source_type, t.source_id, t.available_delta,
              t.balance_after, t.occurred_at, t.occurred_at::text AS occurred_at_raw,
              CASE t.source_type
                WHEN 'mission' THEN (SELECT m.title FROM missions m WHERE m.id = t.source_id)
                WHEN 'shop_order' THEN (SELECT i.name FROM shop_orders o
                                          JOIN shop_items i ON i.id = o.item_id
                                         WHERE o.id = t.source_id)
              END AS source_name
         FROM point_transactions t
        WHERE t.user_id = $1 AND t.available_delta <> 0
          AND ($2::text IS NULL
               OR ($2 = 'earn' AND t.available_delta > 0)
               OR ($2 = 'spend' AND t.available_delta < 0))
          AND ($3::timestamptz IS NULL
               OR (t.occurred_at, t.id) < ($3::timestamptz, $4::uuid))
        ORDER BY t.occurred_at DESC, t.id DESC
        LIMIT $5`,
      [
        userId,
        direction ?? null,
        after?.t ?? null,
        after?.id ?? null,
        limit + 1,
      ],
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        id: row.id,
        kind: row.kind,
        sourceType: row.source_type,
        sourceId: row.source_id,
        title: transactionTitle({
          sourceType: row.source_type,
          sourceName: row.source_name,
          availableDelta: num(row.available_delta),
        }),
        availableDelta: num(row.available_delta),
        balanceAfter: num(row.balance_after),
        occurredAt: row.occurred_at,
      })),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({ t: last.occurred_at_raw, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  /** A76 Achievement[]: 공개된 업적 전체와 내 진행·획득 상태 */
  async achievementList(userId, { rarity }) {
    const { rows } = await this.database.query(
      `SELECT ad.id, ad.code, cur.title, cur.description, cur.rarity,
              cur.condition_type, cur.target_count, cur.reward_points,
              cur.reward_user_xp, cur.reward_pet_xp,
              ua.status AS grant_status, ua.awarded_at
         FROM achievement_definitions ad
         JOIN LATERAL (
           SELECT * FROM achievement_versions v
            WHERE v.achievement_id = ad.id AND v.effective_at <= now()
            ORDER BY v.effective_at DESC, v.version_no DESC LIMIT 1
         ) cur ON true
         LEFT JOIN user_achievements ua
                ON ua.achievement_id = ad.id AND ua.user_id = $1
        WHERE ad.status = 'public' AND ($2::text IS NULL OR cur.rarity = $2)
        ORDER BY cur.target_count, ad.code`,
      [userId, rarity ?? null],
    );
    const items = [];
    for (const row of rows) {
      const earned = row.grant_status === 'active';
      let progressCount = row.target_count;
      if (!earned) {
        const progress = await this.achievements.getProgress(
          this.database,
          userId,
          row.id,
        );
        progressCount = progress.current;
      }
      items.push({
        id: row.id,
        code: row.code,
        title: row.title,
        description: row.description,
        rarity: row.rarity,
        conditionType: row.condition_type,
        targetCount: row.target_count,
        progressCount,
        earned,
        earnedAt: earned ? row.awarded_at : null,
        badgeImageUrl: null,
        rewardPoints: row.reward_points,
        rewardUserXp: row.reward_user_xp,
        rewardPetXp: row.reward_pet_xp,
      });
    }
    return items;
  }
}
