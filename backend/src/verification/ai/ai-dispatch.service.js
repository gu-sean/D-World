import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { MediaService } from '../../media/media.service.js';
import { AI_DISPATCHER } from './ai-dispatcher.js';

const FIRST_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;
const MAX_ATTEMPTS = 8;

/**
 * AI 판정 요청 작업 (3-C-5)
 * 제출됐는데 판정이 없는 회차를 AI에 요청한다. 재시도 상태(횟수·다음 시각)를 둘 테이블이
 * 아직 없어(verification_dispatch_attempts, 문서 05 확인 필요 5) 프로세스 메모리에 둔다:
 * 재시작 시 처음부터 재요청, AI 쪽은 ingestKey·회차 상태 검사로 중복 요청에 안전해야 함
 */
@Injectable()
@Dependencies(DatabaseService, MediaService, AI_DISPATCHER)
export class AiDispatchService {
  logger = new Logger(AiDispatchService.name);
  attempts = new Map(); // recordId → { count, nextAt }

  constructor(database, media, dispatcher) {
    this.database = database;
    this.media = media;
    this.dispatcher = dispatcher;
  }

  async buildRequest(candidate) {
    const { rows: criteria } = await this.database.query(
      `SELECT id, version_no, rules_json FROM verification_criteria_versions
        WHERE category_id = $1 AND verification_method = $2 AND effective_at <= now()
        ORDER BY effective_at DESC, version_no DESC LIMIT 1`,
      [candidate.category_id, candidate.verification_method],
    );
    const { rows: files } = await this.database.query(
      `SELECT id, media_kind, mime_type, actual_size_bytes FROM media_files
        WHERE record_id = $1 AND upload_status = 'uploaded' ORDER BY created_at`,
      [candidate.id],
    );
    const fileRequests = [];
    for (const file of files) {
      const signed = await this.media.signedUrlForAdmin(file.id);
      fileRequests.push({
        id: file.id,
        mediaKind: file.media_kind,
        mimeType: file.mime_type,
        sizeBytes: Number(file.actual_size_bytes),
        url: signed.url,
      });
    }
    return {
      recordId: candidate.id,
      missionId: candidate.mission_id,
      userId: candidate.user_id,
      verificationMethod: candidate.verification_method,
      evidenceKind: candidate.evidence_kind,
      submissionNo: candidate.submission_no,
      metrics: candidate.metrics,
      criteria: criteria[0]
        ? {
            versionId: criteria[0].id,
            versionNo: criteria[0].version_no,
            rules: criteria[0].rules_json,
          }
        : null,
      files: fileRequests,
    };
  }

  next(state, now) {
    const count = (state?.count ?? 0) + 1;
    const delay = Math.min(FIRST_DELAY_MS * 2 ** (count - 1), MAX_DELAY_MS);
    return { count, nextAt: now + delay };
  }

  async dispatchPending({ limit = 50, now = Date.now() } = {}) {
    if (!this.dispatcher.enabled) return { skipped: true };
    const { rows } = await this.database.query(
      `SELECT r.id, r.mission_id, r.user_id, r.evidence_kind, r.submission_no, r.metrics,
              m.category_id, m.verification_method
         FROM mission_records r
         JOIN missions m ON m.id = r.mission_id
        WHERE r.status = 'submitted'
          AND NOT EXISTS (SELECT 1 FROM verification_results v WHERE v.record_id = r.id)
        ORDER BY r.submitted_at LIMIT $1`,
      [limit * 4],
    );
    const pending = new Set(rows.map((row) => row.id));
    for (const id of this.attempts.keys()) {
      // 판정이 났거나 더 이상 대기 상태가 아니면 기록 정리
      if (!pending.has(id)) this.attempts.delete(id);
    }

    const result = { sent: 0, failed: 0, gaveUp: 0 };
    for (const candidate of rows) {
      if (result.sent + result.failed >= limit) break;
      const state = this.attempts.get(candidate.id);
      if (state && state.count >= MAX_ATTEMPTS) {
        result.gaveUp += 1;
        continue;
      }
      if (state && state.nextAt > now) continue;
      try {
        await this.dispatcher.dispatch(await this.buildRequest(candidate));
        // 결과가 오지 않으면 같은 백오프로 다시 요청
        this.attempts.set(candidate.id, this.next(state, now));
        result.sent += 1;
      } catch (err) {
        const next = this.next(state, now);
        this.attempts.set(candidate.id, next);
        result.failed += 1;
        this.logger.warn(
          `AI 요청 실패 record=${candidate.id} 시도=${next.count}: ${err.message}`,
        );
        if (next.count >= MAX_ATTEMPTS) {
          this.logger.error(
            `AI 요청 포기 record=${candidate.id}, 관리자 검수 필요`,
          );
        }
      }
    }
    return result;
  }
}
