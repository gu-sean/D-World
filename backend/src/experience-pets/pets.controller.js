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
} from '@nestjs/common';
import { boolean, string, uuid, validateBody } from '../common/validation.js';
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
export class PetsController {
  constructor(pets) {
    this.pets = pets;
  }

  /** 선택 가능한 종류와 내 해금 진행도 */
  @Get('pets/species')
  @Bind(Req())
  species(req) {
    return this.pets.listSpecies(req.auth.userId);
  }

  @Get('me/pets')
  @Bind(Req())
  list(req) {
    return this.pets.listPets(req.auth.userId);
  }

  @Post('me/pets')
  @Bind(Req(), Body())
  choose(req, body) {
    return this.pets.choosePet(
      req.auth.userId,
      validateBody(body, {
        speciesId: uuid(),
        nickname: petName(),
        makeRepresentative: boolean({ optional: true }),
      }),
    );
  }

  @Put('me/pets/representative')
  @Bind(Req(), Body())
  setRepresentative(req, body) {
    const { petId } = validateBody(body, { petId: uuid() });
    return this.pets.setRepresentative(req.auth.userId, petId);
  }

  @Delete('me/pets/representative')
  @HttpCode(204)
  @Bind(Req())
  async clearRepresentative(req) {
    await this.pets.clearRepresentative(req.auth.userId);
  }

  @Patch('me/pets/:id')
  @Bind(Req(), Param('id'), Body())
  rename(req, id, body) {
    const params = validateBody({ id }, { id: uuid() });
    const { nickname } = validateBody(body, { nickname: petName() });
    return this.pets.renamePet(req.auth.userId, params.id, nickname);
  }
}
