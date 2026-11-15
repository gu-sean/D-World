import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Public } from '../common/auth/public.decorator.js';
import {
  array,
  boolean,
  integer,
  nickname,
  number,
  object,
  oneOf,
  shortId,
  validateBody,
} from '../common/validation.js';
import { AccountsService } from './accounts.service.js';
import { DifficultyAdvisorService } from './difficulty-advisor.service.js';

const consentItem = object({
  documentVersionId: shortId(),
  granted: boolean(),
});

@Controller()
@Dependencies(AccountsService, DifficultyAdvisorService)
export class AccountsController {
  constructor(accounts, difficultyAdvisor) {
    this.accounts = accounts;
    this.difficultyAdvisor = difficultyAdvisor;
  }

  @Public()
  @Get('nicknames/availability')
  @Bind(Query())
  async nicknameAvailability(query) {
    const { nickname: value } = validateBody(query, { nickname: nickname() });
    return {
      nickname: value,
      available: await this.accounts.isNicknameAvailable(value),
    };
  }

  @Public()
  @Get('policies/current')
  listPolicies() {
    return this.accounts.listCurrentPolicies();
  }

  @Get('me')
  @Bind(Req())
  me(request) {
    return this.accounts.getMe(request.auth.userId);
  }

  @Patch('me/profile')
  @Bind(Req(), Body())
  updateProfile(request, body) {
    const data = validateBody(body, {
      nickname: nickname({ optional: true }),
      notificationEnabled: boolean({ optional: true }),
      age: integer({ min: 13, max: 100, optional: true }),
      heightCm: number({ min: 100, max: 250, optional: true }),
      weightKg: number({ min: 30, max: 300, optional: true }),
    });
    return this.accounts.updateProfile(request.auth.userId, data);
  }

  @Post('me/difficulty-recommendations')
  @Bind(Req(), Body())
  recommendDifficulty(request, body) {
    return this.difficultyAdvisor.recommend(
      request.auth.userId,
      validateBody(body, {
        mode: oneOf(['ai_recommendation', 'manual']),
        requestedDifficultyCode: oneOf(['easy', 'normal', 'hard'], {
          optional: true,
        }),
        targetFrequency: integer({ min: 1, max: 7, optional: true }),
        dailyAvailableMinutes: integer({ min: 5, max: 240, optional: true }),
      }),
    );
  }

  @Post('me/consents')
  @Bind(Req(), Body())
  recordConsents(request, body) {
    const { consents } = validateBody(body, {
      consents: array(consentItem, { max: 10 }),
    });
    return this.accounts.recordConsents(request.auth.userId, consents);
  }
}
