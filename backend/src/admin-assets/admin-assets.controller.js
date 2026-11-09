import {
  Bind,
  Body,
  Controller,
  Dependencies,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import {
  AdminIdempotencyService,
  readIdempotencyKey,
} from '../common/idempotency/admin-idempotency.service.js';
import {
  idOf,
  integer,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';
import { AdminAssetsService, MAX_ASSET_BYTES } from './admin-assets.service.js';

/** 관리자 이미지 업로드 API: 업로드 URL 발급(M84), 업로드 완료 확인(M85) */
@Controller('admin/v1/assets')
@AdminOnly()
@Dependencies(AdminMutationService, AdminIdempotencyService, AdminAssetsService)
export class AdminAssetsController {
  constructor(mutation, idempotency, assets) {
    this.mutation = mutation;
    this.idempotency = idempotency;
    this.assets = assets;
  }

  /** M84: ownerId는 기존 업적·펫 종류 id, 새로 만들 항목이면 미리 정한 uuid */
  @Post('upload-urls')
  @Bind(Req(), Body())
  createUploadUrl(request, body) {
    const input = validateBody(body, {
      assetKind: oneOf(['badge', 'pet_stage']),
      ownerId: uuid(),
      mimeType: oneOf(['image/png', 'image/webp', 'image/jpeg']),
      sizeBytes: integer({ min: 1, max: MAX_ASSET_BYTES }),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'asset.upload',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const ticket = await this.assets.createTicket(tx, {
          adminId,
          assetKind: input.assetKind,
          ownerId: input.ownerId,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        });
        return {
          result: ticket,
          after: {
            assetId: ticket.assetId,
            assetKind: input.assetKind,
            ownerId: input.ownerId,
          },
        };
      },
    });
  }

  /** M85: reason·감사 로그 없이 멱등 키만 사용 */
  @Post(':assetId/complete')
  @HttpCode(200)
  @Bind(Req(), Param('assetId'))
  async complete(request, assetId) {
    const id = idOf(assetId);
    const key = readIdempotencyKey(request);
    // 저장소 확인은 트랜잭션 밖에서 (외부 호출 중 DB 잠금을 쥐지 않음)
    const inspected = await this.assets.inspectUpload(id);
    return this.idempotency.run(
      request.auth.adminId,
      {
        key,
        operation: 'asset.complete',
        payload: { assetId: id },
      },
      (tx) => this.assets.completeTicket(tx, id, inspected),
    );
  }
}
