import { Module } from '@nestjs/common';
import { MissionDefinitionsModule } from '../mission-definitions/mission-definitions.module.js';
import { MissionsModule } from '../missions/missions.module.js';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';
import { WeatherAdviceService } from './weather-advice.service.js';
import { WeatherClient } from './weather.client.js';
import { WeatherCollectorService } from './weather-collector.service.js';
import { WeatherStoreService } from './weather-store.service.js';

@Module({
  imports: [MissionDefinitionsModule, MissionsModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    WeatherClient,
    WeatherStoreService,
    WeatherCollectorService,
    WeatherAdviceService,
  ],
  exports: [
    RecommendationsService,
    WeatherCollectorService,
    WeatherAdviceService,
    WeatherStoreService,
  ],
})
export class RecommendationsModule {}
