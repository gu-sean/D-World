import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { toErrorBody } from '../common/errors/error-response.js';
import { AuditService } from './audit.service.js';

/**
 * 관리자 변경 요청 공통 처리: Idempotency-Key 재생 + 감사 로그
 * run(tx)은 { result, before?, after?, targetUserId? } 반환 → result가 응답, after 생략 시 result를 감사 로그에 기록
 * - 성공: 변경과 같은 트랜잭션에 기록
 * - 실패: 변경은 롤백되므로 별도로 기록 (팀 문서 09 §0-5, 성공·실패 모두 감사 로그)
 *   저장된 4xx 응답을 재생하는 경우는 처리가 실행되지 않았으므로 다시 기록하지 않음
 */
@Injectable()
@Dependencies(AuditService, AdminIdempotencyService)
export class AdminMutationService {
  logger = new Logger(AdminMutationService.name);

  constructor(audit, idempotency) {
    this.audit = audit;
    this.idempotency = idempotency;
  }

  async run(adminId, { key, operation, payload, reason, run }) {
    let executed = false;
    try {
      return await this.idempotency.run(
        adminId,
        { key, operation, payload },
        async (tx) => {
          executed = true;
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
    } catch (error) {
      if (executed) await this.recordFailure(adminId, operation, reason, error);
      throw error;
    }
  }

  /** 감사 기록 실패가 원래 오류를 가리지 않도록 삼키고 로그만 남김 */
  async recordFailure(adminId, action, reason, error) {
    try {
      const { statusCode, error: body } = toErrorBody(error);
      await this.audit.record(undefined, {
        adminId,
        action,
        result: 'failure',
        reason,
        after: { statusCode, code: body.code },
      });
    } catch (recordError) {
      this.logger.error(
        `실패 감사 로그 기록 불가(${action}): ${recordError.message}`,
      );
    }
  }
}
