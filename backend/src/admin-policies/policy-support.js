import { unprocessable } from '../common/errors/http-errors.js';

/** 정책 종류·범위별 직렬화(버전 번호 채번) */
export async function lockScope(tx, scope) {
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `policy:${scope}`,
  ]);
}

/** 시행 시각: 생략하면 지금, 1분보다 더 과거면 거절 */
export async function resolveEffectiveAt(tx, effectiveAt) {
  const { rows } = await tx.query(
    `SELECT COALESCE($1::timestamptz, now()) AS at,
            COALESCE($1::timestamptz, now()) < now() - interval '1 minute' AS past`,
    [effectiveAt ?? null],
  );
  if (rows[0].past) {
    throw unprocessable(
      'effective_at_in_past',
      '시행 시각은 지금 이후여야 함(과거로 소급할 수 없음)',
    );
  }
  return rows[0].at;
}

export async function nextVersionNo(tx, table, where, params) {
  const { rows } = await tx.query(
    `SELECT COALESCE(max(version_no), 0) + 1 AS n FROM ${table} ${where}`,
    params,
  );
  return rows[0].n;
}
