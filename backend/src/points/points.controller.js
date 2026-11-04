import {
  Bind,
  Controller,
  Dependencies,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { PointsService } from './points.service.js';

const MAX_LIMIT = 50;

@Controller('me/points')
@Dependencies(PointsService)
export class PointsController {
  constructor(points) {
    this.points = points;
  }

  @Get()
  @Bind(Req())
  wallet(req) {
    return this.points.getWallet(this.points.database, req.auth.userId);
  }

  @Get('transactions')
  @Bind(Req(), Query())
  transactions(req, query) {
    let limit = 20;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
      }
    }
    if (query.cursor !== undefined && typeof query.cursor !== 'string') {
      throw new BadRequestException(['cursor: 문자열이어야 함']);
    }
    return this.points.listTransactions(this.points.database, req.auth.userId, {
      cursor: query.cursor,
      limit,
    });
  }
}
