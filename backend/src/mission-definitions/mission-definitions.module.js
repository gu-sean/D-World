import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module.js';
import { DefinitionReviewController } from './definition-review.controller.js';
import { DefinitionReviewService } from './definition-review.service.js';
import { DefinitionsController } from './definitions.controller.js';
import { DefinitionsService } from './definitions.service.js';

@Module({
  imports: [GoalsModule],
  controllers: [DefinitionsController, DefinitionReviewController],
  providers: [DefinitionsService, DefinitionReviewService],
  exports: [DefinitionsService],
})
export class MissionDefinitionsModule {}
