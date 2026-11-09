import { Bind, Controller, Dependencies, Get, Req } from '@nestjs/common';
import { ExperienceService } from './experience.service.js';

@Controller('me/experience')
@Dependencies(ExperienceService)
export class ExperienceController {
  constructor(experience) {
    this.experience = experience;
  }

  @Get()
  @Bind(Req())
  summary(request) {
    return this.experience.getExperience(
      this.experience.database,
      request.auth.userId,
    );
  }
}
