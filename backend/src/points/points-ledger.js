import { newId } from '../common/ids.js';

/**
 * 포인트 원장 내부 도구, 호출자가 연 트랜잭션(tx)에서만 사용
 * 지갑을 먼저 갱신한 뒤 그 값을 스냅샷으로 거래를 삽입해야 함
 * (거래 삽입 트리거가 잠긴 지갑의 현재 값과 balance_after 일치를 요구)
 */

const toNumber = (value) => Number(value);

/** 지갑 행이 없으면 0으로 만들고 잠금, 이후 변경은 반환 객체를 통해 일관되게 반영 */
export async function lockWallet(tx, userId) {
  await tx.query(
    'INSERT INTO point_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [userId],
  );
  const { rows } = await tx.query(
    `SELECT available_points, outstanding_recovery_points
       FROM point_wallets WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  return {
    userId,
    available: toNumber(rows[0].available_points),
    outstanding: toNumber(rows[0].outstanding_recovery_points),
  };
}

/** 현재 KST 월 1일(YYYY-MM-01), DB 시각 기준이라 한 트랜잭션 안에서 일정 */
export async function currentMonth(tx) {
  const { rows } = await tx.query(
    "SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date AS month",
  );
  return rows[0].month;
}

/** 월간 사용량 행을 만들고 잠금, 지갑 다음 순서로 호출 */
export async function lockUsage(tx, userId, month) {
  await tx.query(
    `INSERT INTO point_monthly_usage (user_id, month_start_date)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, month],
  );
  const { rows } = await tx.query(
    `SELECT gross_auto_awarded_points, same_month_recovered_points
       FROM point_monthly_usage
      WHERE user_id = $1 AND month_start_date = $2 FOR UPDATE`,
    [userId, month],
  );
  return {
    gross: toNumber(rows[0].gross_auto_awarded_points),
    recovered: toNumber(rows[0].same_month_recovered_points),
  };
}

export async function addUsage(
  tx,
  userId,
  month,
  { gross = 0, recovered = 0 },
) {
  await tx.query(
    `UPDATE point_monthly_usage
        SET gross_auto_awarded_points = gross_auto_awarded_points + $3,
            same_month_recovered_points = same_month_recovered_points + $4,
            updated_at = now()
      WHERE user_id = $1 AND month_start_date = $2`,
    [userId, month, gross, recovered],
  );
}

/** 해당 월에 적용되는 월간 한도(신규 정책은 다음 달부터이므로 가장 최근 행) */
export async function monthlyLimit(tx, month) {
  const { rows } = await tx.query(
    `SELECT monthly_limit_points FROM point_monthly_cap_policies
      WHERE effective_month <= $1
      ORDER BY effective_month DESC LIMIT 1`,
    [month],
  );
  if (!rows[0]) throw new Error('월간 포인트 한도 정책이 없음');
  return toNumber(rows[0].monthly_limit_points);
}

/**
 * 지갑을 갱신하고 같은 값을 스냅샷으로 거래를 추가, 거래 id 반환
 * fields: kind, sourceType, sourceId, key, originalTransactionId, recoveryClaimId,
 *         capMonth, capDelta, adminId, reason
 */
export async function recordTransaction(
  tx,
  wallet,
  { availableDelta = 0, outstandingDelta = 0, ...fields },
) {
  wallet.available += availableDelta;
  wallet.outstanding += outstandingDelta;
  await tx.query(
    `UPDATE point_wallets
        SET available_points = $2, outstanding_recovery_points = $3, updated_at = now()
      WHERE user_id = $1`,
    [wallet.userId, wallet.available, wallet.outstanding],
  );

  const id = newId();
  await tx.query(
    `INSERT INTO point_transactions
            (id, user_id, kind, available_delta, outstanding_delta,
             balance_after, outstanding_after, source_type, source_id,
             original_transaction_id, recovery_claim_id, cap_month, cap_delta,
             idempotency_key, created_by_admin_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      id,
      wallet.userId,
      fields.kind,
      availableDelta,
      outstandingDelta,
      wallet.available,
      wallet.outstanding,
      fields.sourceType,
      fields.sourceId,
      fields.originalTransactionId ?? null,
      fields.recoveryClaimId ?? null,
      fields.capMonth ?? null,
      fields.capDelta ?? 0,
      fields.key,
      fields.adminId ?? null,
      fields.reason ?? null,
    ],
  );
  return id;
}

/**
 * 새 적립액으로 미회수액을 오래된 청구부터 정산
 * 정산은 별도 거래이며 이번 달 획득액(한도 집계)을 줄이지 않음
 * 반환: 정산한 총액
 */
export async function settleOutstanding(
  tx,
  wallet,
  { amount, kind, sourceType, sourceId, key, adminId, reason },
) {
  if (wallet.outstanding <= 0 || amount <= 0) return 0;

  const { rows: claims } = await tx.query(
    `SELECT id, outstanding_points FROM point_recovery_claims
      WHERE user_id = $1 AND outstanding_points > 0 AND NOT is_cancelled
      ORDER BY created_at, id
        FOR UPDATE`,
    [wallet.userId],
  );

  let left = Math.min(amount, wallet.outstanding);
  let settled = 0;
  for (const claim of claims) {
    if (left <= 0) break;
    const part = Math.min(left, toNumber(claim.outstanding_points));
    await tx.query(
      `UPDATE point_recovery_claims
          SET outstanding_points = outstanding_points - $2,
              settled_points = settled_points + $2
        WHERE id = $1`,
      [claim.id, part],
    );
    await recordTransaction(tx, wallet, {
      kind,
      availableDelta: -part,
      outstandingDelta: -part,
      sourceType,
      sourceId,
      recoveryClaimId: claim.id,
      key: `${key}:offset:${claim.id}`,
      adminId,
      reason,
    });
    left -= part;
    settled += part;
  }
  return settled;
}
