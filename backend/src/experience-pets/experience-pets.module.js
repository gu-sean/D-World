import { Module } from '@nestjs/common';
import { ExperienceController } from './experience.controller.js';
import { ExperienceService } from './experience.service.js';
import { MobilePetsController } from './mobile-pets.controller.js';
import { MobilePetsService } from './mobile-pets.service.js';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';

/** 다른 도메인 모듈(판정·챌린지·스트릭·업적)이 import해서 ExperienceService를 호출 */
@Module({
  controllers: [ExperienceController, PetsController, MobilePetsController],
  providers: [ExperienceService, PetsService, MobilePetsService],
  exports: [ExperienceService, PetsService],
})
export class ExperiencePetsModule {}
