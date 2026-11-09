import {
  Bind,
  Controller,
  Dependencies,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { parseLimit } from '../common/pagination/limit.js';
import { oneOf, string, validateBody } from '../common/validation.js';
import { MobileRewardsService } from './mobile-rewards.service.js';

/** 읽기 전용이라 이용 제한 중에도 조회 가능 */
@Controller()
@Dependencies(MobileRewardsService)
export class MobileRewardsController {
  constructor(rewards) {
    this.rewards = rewards;
  }

  /** A72 */
  @Get('me/inventory')
  @Bind(Req())
  inventory(request) {
    return this.rewards.inventory(request.auth.userId);
  }

  /** A74 */
  @Get('me/point-transactions')
  @Bind(Req(), Query())
  pointTransactions(request, query) {
    const filters = validateBody(query, {
      direction: oneOf(['earn', 'spend'], { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    return this.rewards.pointTransactions(request.auth.userId, {
      ...filters,
      limit: parseLimit(query, 20, 50),
    });
  }

  /** A76 */
  @Get('achievements')
  @Bind(Req(), Query())
  achievements(request, query) {
    const filters = validateBody(query, {
      rarity: oneOf(['common', 'rare', 'legendary'], { optional: true }),
    });
    return this.rewards.achievementList(request.auth.userId, filters);
  }
}
