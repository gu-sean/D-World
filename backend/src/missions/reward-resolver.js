import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';

const num = (value) => Number(value);

/**
 * 미션 생성 시점의 보상 확정 (docs/backend/04-goals-missions-design.md "보상 확정")
 * - 관리자 템플릿: 원형의 base_points·base_user_xp·base_pet_xp를 복사, 보상표 버전은 없음
 * - 그 외(직접, 사용자 제작 원형, AI): (카테고리, 난이도)의 최신 유효 보상표 버전을 복사
 * 사용자가 금액을 정하는 경로 없음, 생성 후 DB 트리거가 수정 차단
 */
@Injectable()
export class RewardResolver {
  /**
   * db는 반드시 미션을 삽입할 같은 트랜잭션: 트리거가 보상표의 effective_at이
   * 미션의 created_at(트랜잭션 시작 시각) 이전일 것을 요구하므로 같은 now()로 조회해야 함
   */
  async resolve(db, { definition = null, categoryId, difficultyId }) {
    if (definition?.origin === 'admin') {
      return {
        points: num(definition.base_points),
        userXp: num(definition.base_user_xp),
        petXp: num(definition.base_pet_xp),
        rateVersionId: null,
      };
    }

    const { rows } = await db.query(
      `SELECT id, points, user_xp, pet_xp
         FROM mission_reward_rate_versions
        WHERE category_id = $1 AND difficulty_id = $2 AND effective_at <= now()
        ORDER BY effective_at DESC, version_no DESC
        LIMIT 1`,
      [categoryId, difficultyId],
    );
    if (!rows[0]) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'reward_rate_missing',
        '이 카테고리와 난이도에 적용할 보상 기준이 없음',
        { details: { categoryId, difficultyId } },
      );
    }
    return {
      points: num(rows[0].points),
      userXp: num(rows[0].user_xp),
      petXp: num(rows[0].pet_xp),
      rateVersionId: rows[0].id,
    };
  }
}
