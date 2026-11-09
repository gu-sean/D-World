import { Module } from '@nestjs/common';
import { NoticesModule } from '../notices/notices.module.js';
import { AdminNoticesController } from './admin-notices.controller.js';
import { AdminPolicyDocumentsController } from './admin-policy-documents.controller.js';
import { AdminRecommendationMessagesController } from './admin-recommendation-messages.controller.js';

/** 관리자 운영 콘텐츠: 공지(M90~M94), 약관 문서(M95~M97), 추천 문구(M98~M100) */
@Module({
  imports: [NoticesModule],
  controllers: [
    AdminNoticesController,
    AdminPolicyDocumentsController,
    AdminRecommendationMessagesController,
  ],
})
export class AdminContentModule {}
