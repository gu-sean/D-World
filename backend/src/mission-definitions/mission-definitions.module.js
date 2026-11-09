import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module.js';
import { AdminDefinitionsService } from './admin-definitions.service.js';
import { AdminMissionDefinitionsController } from './admin-mission-definitions.controller.js';
import { DefinitionReviewService } from './definition-review.service.js';
import { DefinitionsController } from './definitions.controller.js';
import { DefinitionsService } from './definitions.service.js';

@Module({
  imports: [GoalsModule],
  controllers: [DefinitionsController, AdminMissionDefinitionsController],
  providers: [
    DefinitionsService,
    DefinitionReviewService,
    AdminDefinitionsService,
  ],
  exports: [DefinitionsService],
})
export class MissionDefinitionsModule {}
