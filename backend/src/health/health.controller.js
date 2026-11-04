import {
  Controller,
  Dependencies,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/auth/public.decorator.js';
import { DatabaseService } from '../database/database.service.js';

@Controller('health')
@Public()
@Dependencies(DatabaseService)
export class HealthController {
  logger = new Logger(HealthController.name);

  constructor(database) {
    this.database = database;
  }

  /** 프로세스 생존 확인, DB 미확인 */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** 트래픽 수신 가능 여부, DB 연결 확인 */
  @Get()
  async ready() {
    try {
      await this.database.ping();
    } catch (err) {
      this.logger.error(`DB 헬스 체크 실패: ${err.message}`);
      throw new ServiceUnavailableException('database unavailable');
    }
    return { status: 'ok', database: 'up' };
  }
}
