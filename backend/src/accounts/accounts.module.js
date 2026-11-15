import { Global, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { ActiveAccountGuard } from './active-account.guard.js';
import { ConsentService } from './consent.service.js';
import { DifficultyAdvisorService } from './difficulty-advisor.service.js';
import { RestrictionService } from './restriction.service.js';

/** 다른 도메인 모듈이 @RequireActive()를 쓸 수 있도록 검사 서비스를 전역으로 노출 */
@Global()
@Module({
  imports: [MediaModule],
  controllers: [AccountsController],
  providers: [
    AccountsService,
    ConsentService,
    DifficultyAdvisorService,
    RestrictionService,
    ActiveAccountGuard,
  ],
  exports: [
    ConsentService,
    DifficultyAdvisorService,
    RestrictionService,
    ActiveAccountGuard,
  ],
})
export class AccountsModule {}
