import { createHash, timingSafeEqual } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app-exception.js';
import { rethrowConstraint } from '../../common/errors/constraint.js';
import { DatabaseService } from '../../database/database.service.js';
import { DecisionService } from '../decision.service.js';
import { AiDispatchService } from './ai-dispatch.service.js';

const digest = (value) => createHash('sha256').update(String(value)).digest();

/**
 * AI 판정 결과 수신
 * AI 서비스(FastAPI)가 공유 비밀 헤더로 호출, 사용자·관리자 토큰 미사용
 * 규격(ingestKey 형식, 인증 방식, 신뢰도 임곗값)은 AI 쪽과 확정 전까지 이 제안안 적용
 */
@Injectable()
@Dependencies(
  DatabaseService,
  ConfigService,
  DecisionService,
  AiDispatchService,
)
export class AiIngestService {
  constructor(database, config, decisions, dispatch) {
    this.database = database;
    this.config = config;
    this.decisions = decisions;
    this.dispatch = dispatch;
  }

  /** 공유 비밀 확인: 설정이 없으면 엔드포인트를 닫고, 불일치는 상수 시간으로 비교해 401 */
  assertSecret(request) {
    const expected = this.config.get('INTERNAL_API_TOKEN');
    if (!expected) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'ai_ingest_disabled',
        'AI 결과 수신이 설정되지 않음',
      );
    }
    const given = request.headers?.['x-internal-token'];
    if (
      typeof given !== 'string' ||
      !timingSafeEqual(digest(given), digest(expected))
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'unauthorized',
        '인증 필요',
      );
    }
  }

  /**
   * 분석 실패 통보(status=failed): 제출 대기 중인 회차만 review_required로 돌리고 판정 행은 만들지 않는다
   * 이미 판정이 났거나 종료된 회차는 건드리지 않고 ignored로 응답 (재전송에 안전)
   */
  async ingestFailure(input) {
    const { rows } = await this.database.query(
      'SELECT status FROM mission_records WHERE id = $1',
      [input.recordId],
    );
    if (!rows[0]) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'record_not_found',
        '수행 회차를 찾을 수 없음',
      );
    }
    if (rows[0].status !== 'submitted') {
      return { status: 'ignored', recordStatus: rows[0].status };
    }
    await this.dispatch.giveUp(input.recordId, {
      reason: input.failureReason ?? 'AI 분석 실패',
    });
    return { status: 'failed_handled', recordStatus: 'review_required' };
  }

  /**
   * 결과 반영: 같은 ingestKey는 한 번만 처리하고(재전송은 첫 결과 반환),
   * 이미 판정이 끝났거나 종료된 회차에 늦게 온 결과는 기록하지 않고 ignored로 응답
   */
  async ingest(input) {
    // AI가 분석에 실패했다고 알려 온 경우: 판정 없이 관리자 검수로 넘긴다
    if (input.status === 'failed') return this.ingestFailure(input);
    try {
      const result = await this.database.withTransaction((tx) =>
        this.decisions.applyDecision(tx, {
          ...input,
          source: 'ai',
          allowedStatuses: ['submitted'],
          ignoreIfNotJudgeable: true,
        }),
      );
      return {
        status: result.outcome,
        ...(result.resultId ? { resultId: result.resultId } : {}),
        ...(result.decision ? { decision: result.decision } : {}),
        ...(result.transition ? { transition: result.transition } : {}),
        ...(result.missionStatus
          ? { missionStatus: result.missionStatus }
          : {}),
        ...(result.recordStatus ? { recordStatus: result.recordStatus } : {}),
      };
    } catch (error) {
      // 다른 회차에서 같은 ingestKey가 동시에 들어온 경우
      rethrowConstraint(error, {
        verification_results_ingest_key_uq: () =>
          new AppException(
            HttpStatus.CONFLICT,
            'ingest_key_reused',
            '같은 ingestKey로 다른 요청이 처리됨',
          ),
      });
    }
  }
}
