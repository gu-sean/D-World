import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AppException } from '../common/errors/app-exception.js';

// 필수 문서는 철회 불가(철회는 탈퇴로 처리), 마케팅은 선택
const REQUIRED_TYPES = ['terms', 'privacy'];

@Injectable()
@Dependencies(DatabaseService)
export class ConsentService {
  constructor(database) {
    this.database = database;
  }

  /** 문서 종류별 현재 유효한(게시·시행일 도래) 최신 버전 */
  async currentVersions(db = this.database) {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (document_type)
              id, document_type, version, body, effective_at, requires_reconsent
         FROM policy_document_versions
        WHERE published_at IS NOT NULL AND effective_at <= now()
        ORDER BY document_type, effective_at DESC`,
    );
    return rows;
  }

  /** 가입 시 필수 문서의 현재 버전에 모두 동의했는지 */
  assertSignupConsents(current, consents) {
    for (const type of REQUIRED_TYPES) {
      const version = current.find((v) => v.document_type === type);
      if (!version) continue;
      const granted = consents.some(
        (c) => c.documentVersionId === version.id && c.granted,
      );
      if (!granted) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'consent_required',
          '필수 약관에 동의해야 함',
        );
      }
    }
  }

  /**
   * 동의 이력 추가(덮어쓰지 않음), 현재 유효 버전에 대해서만 기록
   * current를 넘기면 재조회 없이 사용
   */
  async record(tx, userId, consents, current) {
    const versions = current ?? (await this.currentVersions(tx));
    const byId = new Map(versions.map((v) => [v.id, v]));
    for (const consent of consents) {
      const version = byId.get(consent.documentVersionId);
      if (!version) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'invalid_document_version',
          '현재 유효한 문서 버전이 아님',
        );
      }
      if (!consent.granted && REQUIRED_TYPES.includes(version.document_type)) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'consent_required',
          '필수 약관 동의는 철회할 수 없음',
        );
      }
    }
    for (const consent of consents) {
      await tx.query(
        `INSERT INTO consent_records (id, user_id, document_version_id, granted)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, consent.documentVersionId, consent.granted],
      );
    }
  }

  /**
   * 재동의가 필요한 문서 종류
   * 재동의 필수로 게시된 최신 버전 이후(시행일 기준) 버전에 동의한 기록이 없으면 대상
   */
  async pendingReconsent(userId, db = this.database) {
    const { rows } = await db.query(
      `SELECT r.document_type
         FROM (
           SELECT DISTINCT ON (document_type) document_type, effective_at
             FROM policy_document_versions
            WHERE published_at IS NOT NULL
              AND effective_at <= now()
              AND requires_reconsent
              AND document_type = ANY($2::text[])
            ORDER BY document_type, effective_at DESC
         ) r
        WHERE NOT EXISTS (
          SELECT 1
            FROM consent_records c
            JOIN policy_document_versions v ON v.id = c.document_version_id
           WHERE c.user_id = $1
             AND c.granted
             AND v.document_type = r.document_type
             AND v.effective_at >= r.effective_at
        )`,
      [userId, REQUIRED_TYPES],
    );
    return rows.map((row) => row.document_type);
  }
}
