import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AdminAchievementsController } from './admin-achievements.controller.js';
import { AdminAssetsController } from './admin-assets.controller.js';
import { AdminAssetsService } from './admin-assets.service.js';
import { AdminPetSpeciesController } from './admin-pet-species.controller.js';

/** 관리자 업적(M76~M78)·펫 종류(M79~M81)·이미지 업로드(M84·M85) API */
@Module({
  imports: [MediaModule],
  controllers: [
    AdminAchievementsController,
    AdminPetSpeciesController,
    AdminAssetsController,
  ],
  providers: [AdminAssetsService],
})
export class AdminAssetsModule {}
