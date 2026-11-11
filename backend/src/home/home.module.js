import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { HomeController } from './home.controller.js';
import { HomeService } from './home.service.js';

@Module({
  imports: [RecommendationsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
