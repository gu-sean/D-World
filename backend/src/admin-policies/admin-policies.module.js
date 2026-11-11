import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller.js';
import { CatalogService } from './catalog.service.js';
import { GrowthPoliciesService } from './growth-policies.service.js';
import { RewardPoliciesService } from './reward-policies.service.js';

/** 관리자가 보상표·판정 기준·스트릭 금액·월 한도·레벨 정책·분야·난이도를 설정하는 API */
@Module({
  controllers: [PoliciesController],
  providers: [CatalogService, RewardPoliciesService, GrowthPoliciesService],
})
export class AdminPoliciesModule {}
