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
  nickname,
  object,
  shortId,
  validateBody,
} from '../common/validation.js';
import { AccountsService } from './accounts.service.js';

const consentItem = object({
  documentVersionId: shortId(),
  granted: boolean(),
});

@Controller()
@Dependencies(AccountsService)
export class AccountsController {
  constructor(accounts) {
    this.accounts = accounts;
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
    });
    return this.accounts.updateProfile(request.auth.userId, data);
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
