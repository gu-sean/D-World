import { Module } from '@nestjs/common';
import { PointsController } from './points.controller.js';
import { PointsService } from './points.service.js';

/** 다른 도메인 모듈(판정·챌린지·스트릭·업적)이 import해서 PointsService를 호출 */
@Module({
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
