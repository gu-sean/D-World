import {
  Bind,
  Controller,
  Dependencies,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/auth/public.decorator.js';
import { sha256Hex } from '../common/crypto/crypto.js';
import { AppException } from '../common/errors/app-exception.js';
import { notFound } from '../common/errors/http-errors.js';
import { JobsService } from './jobs.service.js';

const digest = (value) => Buffer.from(sha256Hex(value), 'hex');

/**
 * 개발용 수동 실행: POST /internal/v1/dev/jobs/{jobName} (X-Internal-Token 필요)
 * NODE_ENV=production이면 JobsModule이 이 컨트롤러를 등록하지 않음
 */
@Controller('internal/v1/dev/jobs')
@Public()
@SkipThrottle()
@Dependencies(ConfigService, JobsService)
export class DevJobsController {
  constructor(config, jobs) {
    this.config = config;
    this.jobs = jobs;
  }

  @Post(':jobName')
  @HttpCode(200)
  @Bind(Req(), Param('jobName'))
  async run(request, jobName) {
    const expected = this.config.get('INTERNAL_API_TOKEN');
    const given = request.headers['x-internal-token'];
    if (
      !expected ||
      typeof given !== 'string' ||
      !timingSafeEqual(digest(given), digest(expected))
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'unauthorized',
        '인증 필요',
      );
    }
    if (!this.jobs.names().includes(jobName))
      throw notFound('not_found', '알 수 없는 작업');
    const result = await this.jobs.runJob(jobName);
    return { job: jobName, ok: !result?.error };
  }
}
