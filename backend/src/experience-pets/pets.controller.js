import {
  Bind,
  Body,
  Controller,
  Delete,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  boolean,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { PetsService } from './pets.service.js';

// 한글·영문 2~10자 (DB 제약과 같은 기준)
const petName = () =>
  string({
    min: 2,
    max: 10,
    pattern: /^[가-힣A-Za-z]+$/,
    patternMessage: '한글·영문만 사용 가능',
  });

@Controller()
@Dependencies(PetsService)
@UseInterceptors(UserIdempotencyInterceptor)
export class PetsController {
  constructor(pets) {
    this.pets = pets;
  }

  /** 선택 가능한 종류와 내 해금 진행도 */
  @Get('pets/species')
  @Bind(Req())
  species(request) {
    return this.pets.listSpecies(request.auth.userId);
  }

  @Get('me/pets')
  @Bind(Req())
  list(request) {
    return this.pets.listPets(request.auth.userId);
  }

  @Post('me/pets')
  @Idempotent({ optional: true })
  @Bind(Req(), Body())
  choose(request, body) {
    return this.pets.choosePet(
      request.auth.userId,
      validateBody(body, {
        speciesId: shortId(),
        nickname: petName(),
        makeRepresentative: boolean({ optional: true }),
      }),
    );
  }

  @Put('me/pets/representative')
  @Bind(Req(), Body())
  setRepresentative(request, body) {
    const { petId } = validateBody(body, { petId: shortId() });
    return this.pets.setRepresentative(request.auth.userId, petId);
  }

  @Delete('me/pets/representative')
  @HttpCode(204)
  @Bind(Req())
  async clearRepresentative(request) {
    await this.pets.clearRepresentative(request.auth.userId);
  }

  @Patch('me/pets/:id')
  @Bind(Req(), Param('id'), Body())
  rename(request, id, body) {
    const params = validateBody({ id }, { id: shortId() });
    const { nickname } = validateBody(body, { nickname: petName() });
    return this.pets.renamePet(request.auth.userId, params.id, nickname);
  }
}
