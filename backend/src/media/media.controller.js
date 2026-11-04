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
} from '@nestjs/common';
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
  register(req, recordId, body) {
    return this.media.register(
      req.auth.userId,
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

  @Get('records/:recordId/media')
  @Bind(Req(), Param('recordId'))
  list(req, recordId) {
    return this.media.list(req.auth.userId, idOf(recordId));
  }

  @Post('media/:id/complete')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  complete(req, id) {
    return this.media.complete(req.auth.userId, idOf(id));
  }

  @Post('media/:id/retry')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  retry(req, id) {
    return this.media.retry(req.auth.userId, idOf(id));
  }

  @Get('media/:id/url')
  @Bind(Req(), Param('id'))
  url(req, id) {
    return this.media.signedUrl(req.auth.userId, idOf(id));
  }

  @Delete('media/:id')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async remove(req, id) {
    await this.media.remove(req.auth.userId, idOf(id));
  }
}
