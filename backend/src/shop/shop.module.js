import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module.js';
import { ShopController } from './shop.controller.js';
import { ShopService } from './shop.service.js';

/** 포인트 상점: 상품 조회·주문·환불·보유 수량·사용 */
@Module({
  imports: [PointsModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
