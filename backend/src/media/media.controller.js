import {
  idOf,
  integer,
  oneOf,
  string,
  validateBody,
} from '../common/validation.js';
import { MEDIA_KINDS } from './media.constants.js';
import { MediaService } from './media.service.js';
import {
  Bind,
  Body,
  Controller,
  Delete,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { RequireActive } from '../accounts/active-account.guard.js';

@Controller()
@Dependencies(MediaService)
export class MediaController {
  constructor(media) {
    this.media = media;
  }

  /** 업로드 등록: 서명된 업로드 URL을 받아 앱이 R2에 직접 올림 */
  @Post('records/:recordId/media')
  @RequireActive()
  @Bind(Req(), Param('recordId'), Body())
  register(request, recordId, body) {
    return this.media.register(
      request.auth.userId,
      idOf(recordId),
      validateBody(body, {
        mediaKind: oneOf(MEDIA_KINDS),
        mimeType: string({ min: 3, max: 100 }),
        sizeBytes: integer({ min: 1, max: 1_073_741_824 }),
        checksumSha256: string({
          min: 64,
          max: 64,
          pattern: /^[0-9a-fA-F]{64}$/,
          patternMessage: 'SHA-256 hex 64자여야 함',
          optional: true,
        }),
      }),
    );
  }

  /** A43: 업로드 URL 받기 (멱등 필수), 모바일 MediaUploadTicket 모양 */
  @Post('mission-records/:recordId/media')
  @UseInterceptors(UserIdempotencyInterceptor)
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('recordId'), Body())
  async registerMobile(request, recordId, body) {
    const view = await this.register(request, recordId, body);
    return {
      mediaId: view.id,
      uploadUrl: view.upload.url,
      uploadMethod: 'PUT',
      uploadHeaders: view.upload.headers,
      expiresAt: view.upload.expiresAt,
    };
  }

  @Get('records/:recordId/media')
  @Bind(Req(), Param('recordId'))
  list(request, recordId) {
    return this.media.list(request.auth.userId, idOf(recordId));
  }

  @Post('media/:id/complete')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  complete(request, id) {
    return this.media.complete(request.auth.userId, idOf(id));
  }

  @Post('media/:id/retry')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  retry(request, id) {
    return this.media.retry(request.auth.userId, idOf(id));
  }

  @Get('media/:id/url')
  @Bind(Req(), Param('id'))
  url(request, id) {
    return this.media.signedUrl(request.auth.userId, idOf(id));
  }

  @Delete('media/:id')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async remove(request, id) {
    await this.media.remove(request.auth.userId, idOf(id));
  }
}
