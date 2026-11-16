import {
  Bind,
  Controller,
  Dependencies,
  Get,
  Param,
  Post,
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
import { PetXpService } from './pet-xp.service.js';
import { DatabaseService } from '../database/database.service.js';

/** 모바일 클라이언트 펫 API A81~A83, A85 */
@Controller()
@Dependencies(MobilePetsService, PetXpService, DatabaseService)
export class MobilePetsController {
  constructor(pets, petXp, database) {
    this.pets = pets;
    this.petXp = petXp;
    this.database = database;
  }

  /** 펫 경험치 지갑: 아직 펫에게 주지 않은 경험치 (022) */
  @Get('me/pet-xp')
  @Bind(Req())
  wallet(request) {
    return this.petXp.getWallet(this.database, request.auth.userId);
  }

  /** 경험치 주기: 지갑에서 10을 빼서 펫에게 (아기 단계만) */
  @Post('me/pets/:petId/feed')
  @Bind(Req(), Param('petId'))
  feed(request, petId) {
    return this.petXp.feed(request.auth.userId, idOf(petId));
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
