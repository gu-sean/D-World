import { Global, Module } from '@nestjs/common';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { AuditLogsController } from './audit-logs.controller.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminMutationService } from './admin-mutation.service.js';
import { AuditService } from './audit.service.js';

/** AuditService·AdminIdempotencyService는 이후 관리자 변경 API 모듈이 공통으로 사용 */
@Global()
@Module({
  controllers: [AdminAuthController, AuditLogsController],
  providers: [
    AdminAuthService,
    AuditService,
    AdminIdempotencyService,
    AdminMutationService,
  ],
  exports: [AuditService, AdminIdempotencyService, AdminMutationService],
})
export class AdminAuthModule {}
