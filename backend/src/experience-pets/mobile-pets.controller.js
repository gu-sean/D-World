import {
  Bind,
  Controller,
  Dependencies,
  Get,
  Param,
  Put,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import {
  idOf,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { MobilePetsService } from './mobile-pets.service.js';

/** 모바일 클라이언트 펫 API A81~A83, A85 */
@Controller()
@Dependencies(MobilePetsService)
export class MobilePetsController {
  constructor(pets) {
    this.pets = pets;
  }

  /** A81 PetSpecies[] (categoryCode 필터는 전역 인터셉터가 categoryId로 바꿔 줌) */
  @Get('pet-species')
  @Bind(Req(), Query())
  species(request, query) {
    const { categoryId } = validateBody(query, {
      categoryId: shortId({ optional: true }),
    });
    return this.pets.listSpecies(request.auth.userId, { categoryId });
  }

  /** A82 */
  @Get('pet-species/:speciesId')
  @Bind(Req(), Param('speciesId'))
  speciesDetail(request, speciesId) {
    return this.pets.speciesDetail(request.auth.userId, idOf(speciesId));
  }

  /** A83 대표 펫 설정, Pet을 돌려줌 */
  @Put('me/representative-pet')
  @Bind(Req(), Body())
  async setRepresentative(request, body) {
    const { petId } = validateBody(body, { petId: shortId() });
    return this.pets.setRepresentative(request.auth.userId, petId);
  }

  /** A85 PetEvolution[] (after 이후만) */
  @Get('me/pets/:petId/evolution-events')
  @Bind(Req(), Param('petId'), Query())
  evolutionEvents(request, petId, query) {
    const { after } = validateBody(query, {
      after: timestamp({ optional: true }),
    });
    return this.pets.evolutionEvents(request.auth.userId, idOf(petId), after);
  }
}
