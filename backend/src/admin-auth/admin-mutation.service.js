import { Dependencies, Injectable } from '@nestjs/common';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { AuditService } from './audit.service.js';

/**
 * 관리자 변경 요청 공통 처리: Idempotency-Key 재생 + 감사 로그를 변경과 같은 트랜잭션에 기록
 * run(tx)은 { result, before?, after?, targetUserId? } 반환 → result가 응답, after 생략 시 result를 감사 로그에 기록
 */
@Injectable()
@Dependencies(AuditService, AdminIdempotencyService)
export class AdminMutationService {
  constructor(audit, idempotency) {
    this.audit = audit;
    this.idempotency = idempotency;
  }

  run(adminId, { key, operation, payload, reason, run }) {
    return this.idempotency.run(
      adminId,
      { key, operation, payload },
      async (tx) => {
        const { result, before, after, targetUserId } = await run(tx);
        await this.audit.record(tx, {
          adminId,
          targetUserId,
          action: operation,
          result: 'success',
          reason,
          before,
          after: after ?? result,
        });
        return result;
      },
    );
  }
}
