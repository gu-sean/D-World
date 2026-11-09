import { Module } from '@nestjs/common';
import { AdminBillingController } from './admin-billing.controller.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';

/** 관리자 대시보드(M05)와 결제·구독 껍데기(M110) */
@Module({
  controllers: [AdminDashboardController, AdminBillingController],
})
export class AdminDashboardModule {}
