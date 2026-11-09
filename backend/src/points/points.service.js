import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import {
  addUsage,
  currentMonth,
  lockUsage,
  lockWallet,
  monthlyLimit,
  recordTransaction,
  settleOutstanding,
} from './points-ledger.js';

const MISSION = 'mission';

// 미회수 청구가 가리키는 지급 행의 컬럼(016 마이그레이션), 쿼리에 들어가므로 고정 목록만 사용
const CLAIM_COLUMNS = {
  mission: 'mission_id',
  streak: 'streak_milestone_award_id',
  achievement: 'user_achievement_id',
  challenge: 'challenge_reward_grant_id',
};

function assertAutoSource(sourceType) {
  if (sourceType === MISSION || !CLAIM_COLUMNS[sourceType]) {
    throw new RangeError(`자동 보상 소스가 아님: ${sourceType}`);
  }
}

function assertPoints(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name}는 0 이상의 정수여야 함: ${value}`);
  }
}

const num = (value) => Number(value);

/**
 * 포인트 지갑·원장 공통 서비스
 * 변경 메서드는 호출자가 연 트랜잭션(tx)을 받고, 같은 호출을 반복해도 한 번만 반영
 * 잠금 순서: 지급 행 → 지갑 → 월간 사용량 (docs/backend/03-reward-services-design.md)
 */
@Injectable()
@Dependencies(DatabaseService)
export class PointsService {
  constructor(database) {
    this.database = database;
  }

  /**
   * 미션 승인 보상 지급
   * originalPoints는 미션 생성 때 확정된 금액(missions.reward_points)
   * 월 한도 잔여분만 지급하고 초과분은 소멸, 0P 지급도 행을 남겨 재지급을 막음
   */
  async awardMissionPoints(
    tx,
    { userId, missionId, resultId, originalPoints },
  ) {
    assertPoints(originalPoints, 'originalPoints');

    const existing = await this.findMissionAward(tx, userId, missionId, true);
    if (existing) return this.existingAward(existing, originalPoints);

    const wallet = await lockWallet(tx, userId);
    // 같은 사용자의 동시 요청은 지갑 잠금에서 직렬화되므로 잠근 뒤 한 번 더 확인
    const raced = await this.findMissionAward(tx, userId, missionId, false);
    if (raced) return this.existingAward(raced, originalPoints);

    const month = await currentMonth(tx);
    const usage = await lockUsage(tx, userId, month);
    const limit = await monthlyLimit(tx, month);
    const remaining = Math.max(limit - (usage.gross - usage.recovered), 0);
    const paid = Math.min(originalPoints, remaining);

    await tx.query(
      `INSERT INTO mission_point_awards
              (mission_id, user_id, first_approved_result_id,
               original_points, paid_points, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [missionId, userId, resultId, originalPoints, paid],
    );

    let settled = 0;
    if (paid > 0) {
      settled = await this.creditAuto(tx, wallet, {
        month,
        paid,
        sourceType: MISSION,
        sourceId: missionId,
        key: `mission:award:${missionId}`,
      });
    }
    return {
      outcome: 'created',
      originalPoints,
      paidPoints: paid,
      settledPoints: settled,
      capped: paid < originalPoints,
      balance: wallet.available,
    };
  }

  /** 지갑 잠금만 필요한 호출자(락 순서를 지갑 → 도메인 순으로 맞추려는 모듈)용 */
  async lockUserWallet(tx, userId) {
    await lockWallet(tx, userId);
  }

  /**
   * 지급 행(paid_points가 불변인 스트릭 마일스톤 등)을 먼저 만들어야 하는 호출자를 위해
   * 이번 달 한도로 실제 지급될 금액을 미리 계산, 지갑·월간 사용량을 잠그므로 같은 트랜잭션에서
   * awardAutoPoints를 이어서 호출하면 같은 값
   */
  async previewAutoPaid(tx, { userId, originalPoints }) {
    assertPoints(originalPoints, 'originalPoints');
    await lockWallet(tx, userId);
    const month = await currentMonth(tx);
    const usage = await lockUsage(tx, userId, month);
    const limit = await monthlyLimit(tx, month);
    const remaining = Math.max(limit - (usage.gross - usage.recovered), 0);
    return Math.min(originalPoints, remaining);
  }

  /**
   * 스트릭·업적·챌린지 자동 보상 지급
   * sourceId의 소유 행(streak_milestone_awards, user_achievements, challenge_reward_grants)은
   * 호출자가 같은 트랜잭션에서 먼저 만들어 둬야 함(DB 트리거가 검증)
   * 한도를 넘는 초과분은 소멸, 지급 행의 기록은 각 도메인이 소유
   */
  async awardAutoPoints(
    tx,
    { userId, sourceType, sourceId, originalPoints, key },
  ) {
    assertPoints(originalPoints, 'originalPoints');
    if (sourceType === MISSION) {
      throw new RangeError('미션은 awardMissionPoints를 사용');
    }

    const duplicate = await this.findByKey(tx, key);
    if (duplicate) {
      return {
        outcome: 'already_applied',
        originalPoints,
        paidPoints: num(duplicate.available_delta),
      };
    }

    const wallet = await lockWallet(tx, userId);
    const month = await currentMonth(tx);
    const usage = await lockUsage(tx, userId, month);
    const limit = await monthlyLimit(tx, month);
    const remaining = Math.max(limit - (usage.gross - usage.recovered), 0);
    const paid = Math.min(originalPoints, remaining);

    let settled = 0;
    if (paid > 0) {
      settled = await this.creditAuto(tx, wallet, {
        month,
        paid,
        sourceType,
        sourceId,
        key,
      });
    }
    return {
      outcome: 'created',
      originalPoints,
      paidPoints: paid,
      settledPoints: settled,
      capped: paid < originalPoints,
      balance: wallet.available,
    };
  }

  /** 적립 거래 → 미회수액 정산 → 월간 사용량 반영 (지갑은 거래마다 먼저 갱신) */
  async creditAuto(tx, wallet, { month, paid, sourceType, sourceId, key }) {
    await recordTransaction(tx, wallet, {
      kind: 'auto_award',
      availableDelta: paid,
      sourceType,
      sourceId,
      capMonth: month,
      capDelta: paid,
      key,
    });
    await addUsage(tx, wallet.userId, month, { gross: paid });
    return settleOutstanding(tx, wallet, {
      amount: paid,
      kind: 'award_offset',
      sourceType,
      sourceId,
      key,
    });
  }

  /**
   * 판정 번복으로 미션 보상 회수
   * 가용 잔액만큼 즉시 회수하고 부족분은 미회수액으로 기록, 잔액은 0 미만이 되지 않음
   * 지급과 같은 KST 월이면 실제 회수액만큼 그 달 한도 복원, 지난달 지급분은 복원 안 함
   * resultId는 번복을 일으킨 판정 결과 id(멱등 키에 사용)
   */
  async revokeMissionPoints(tx, { userId, missionId, resultId }) {
    const award = await this.requireMissionAward(tx, userId, missionId);
    if (award.status === 'revoked') return { outcome: 'already_applied' };

    const paid = num(award.paid_points);
    if (paid === 0) {
      await this.setAwardStatus(tx, missionId, 'revoked');
      return { outcome: 'revoked', recoveredPoints: 0, outstandingPoints: 0 };
    }

    const awardTx = await this.findByKey(tx, `mission:award:${missionId}`);
    const result = await this.recoverSource(tx, {
      userId,
      sourceType: MISSION,
      sourceId: missionId,
      resultId,
      paid,
      awardTx,
    });
    await this.setAwardStatus(tx, missionId, 'revoked');
    return { outcome: 'revoked', ...result };
  }

  /**
   * 재승인 시 가장 최근 회수를 정정해 복구
   * 미회수액은 취소하고, 이미 정산된 금액과 즉시 회수분은 잔액으로 반환
   * 원 지급 월의 한도 집계를 정정하며 복구된 달의 한도는 쓰지 않음(새 보상이 아님)
   */
  async reinstateMissionPoints(tx, { userId, missionId, resultId }) {
    const award = await this.requireMissionAward(tx, userId, missionId);
    if (award.status === 'active') return { outcome: 'already_applied' };

    if (num(award.paid_points) === 0) {
      await this.setAwardStatus(tx, missionId, 'active');
      return { outcome: 'reinstated', returnedPoints: 0 };
    }

    const result = await this.reinstateSource(tx, {
      userId,
      sourceType: MISSION,
      sourceId: missionId,
      resultId,
    });
    await this.setAwardStatus(tx, missionId, 'active');
    return { outcome: 'reinstated', ...result };
  }

  /**
   * 스트릭·업적·챌린지 보상 회수, 미션과 같은 규칙
   * 지급 상태(status)는 각 도메인 행이 소유하므로 호출자가 같은 트랜잭션에서 갱신
   * 이미 회수된 상태인지는 원장의 마지막 회수·복구 거래로 판단해 중복 처리를 막음
   */
  async revokeAutoPoints(tx, { userId, sourceType, sourceId, resultId }) {
    assertAutoSource(sourceType);
    await lockWallet(tx, userId);
    if (
      (await this.latestRecoveryEvent(tx, userId, sourceType, sourceId)) ===
      'revoked'
    ) {
      return { outcome: 'already_applied' };
    }
    const awardTx = await this.findAutoAward(tx, userId, sourceType, sourceId);
    // 지급액 0(한도 소진)이면 원장 거래가 없으므로 되돌릴 포인트도 없음
    if (!awardTx) {
      return { outcome: 'revoked', recoveredPoints: 0, outstandingPoints: 0 };
    }
    const result = await this.recoverSource(tx, {
      userId,
      sourceType,
      sourceId,
      resultId,
      paid: num(awardTx.available_delta),
      awardTx,
    });
    return { outcome: 'revoked', ...result };
  }

  async reinstateAutoPoints(tx, { userId, sourceType, sourceId, resultId }) {
    assertAutoSource(sourceType);
    await lockWallet(tx, userId);
    if (
      (await this.latestRecoveryEvent(tx, userId, sourceType, sourceId)) !==
      'revoked'
    ) {
      return { outcome: 'already_applied' };
    }
    const result = await this.reinstateSource(tx, {
      userId,
      sourceType,
      sourceId,
      resultId,
    });
    return { outcome: 'reinstated', ...result };
  }

  /** 회수 거래의 공통 구현: 즉시 회수 → 부족분 청구 → 한도 복원 */
  async recoverSource(
    tx,
    { userId, sourceType, sourceId, resultId, paid, awardTx },
  ) {
    const wallet = await lockWallet(tx, userId);
    const month = await currentMonth(tx);
    const sameMonth = awardTx.cap_month === month;

    const recoverNow = Math.min(paid, wallet.available);
    const shortfall = paid - recoverNow;
    const keyBase = `${sourceType}:recovery:${sourceId}:${resultId}`;

    if (recoverNow > 0) {
      if (sameMonth) {
        await lockUsage(tx, userId, month);
        await addUsage(tx, userId, month, { recovered: recoverNow });
      }
      await recordTransaction(tx, wallet, {
        kind: 'recovery',
        availableDelta: -recoverNow,
        sourceType,
        sourceId,
        originalTransactionId: awardTx.id,
        capMonth: sameMonth ? month : null,
        capDelta: sameMonth ? -recoverNow : 0,
        key: keyBase,
      });
    }

    if (shortfall > 0) {
      const claimId = randomUUID();
      // 컬럼 이름은 고정 목록에서만 선택
      await tx.query(
        `INSERT INTO point_recovery_claims
                (id, user_id, ${CLAIM_COLUMNS[sourceType]}, original_award_transaction_id,
                 target_points, outstanding_points)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [claimId, userId, sourceId, awardTx.id, shortfall],
      );
      await recordTransaction(tx, wallet, {
        kind: 'recovery_claim',
        outstandingDelta: shortfall,
        sourceType,
        sourceId,
        originalTransactionId: awardTx.id,
        recoveryClaimId: claimId,
        key: `${keyBase}:claim`,
      });
    }

    return {
      recoveredPoints: recoverNow,
      outstandingPoints: shortfall,
      balance: wallet.available,
    };
  }

  /** 복구 거래의 공통 구현: 가장 최근 회수 묶음을 찾아 청구 취소 → 잔액 반환 → 한도 정정 */
  async reinstateSource(tx, { userId, sourceType, sourceId, resultId }) {
    const wallet = await lockWallet(tx, userId);
    const { rows } = await tx.query(
      `SELECT id, kind, available_delta, cap_month, cap_delta, recovery_claim_id
         FROM point_transactions
        WHERE user_id = $1 AND source_type = $2 AND source_id = $3
          AND kind IN ('recovery', 'recovery_claim')
          AND occurred_at = (
            SELECT max(occurred_at) FROM point_transactions
             WHERE user_id = $1 AND source_type = $2 AND source_id = $3
               AND kind IN ('recovery', 'recovery_claim'))`,
      [userId, sourceType, sourceId],
    );
    const recovery = rows.find((row) => row.kind === 'recovery');
    const claimRow = rows.find((row) => row.kind === 'recovery_claim');
    const keyBase = `${sourceType}:reinstate:${sourceId}:${resultId}`;

    let returned = 0;
    if (claimRow) {
      const { rows: claims } = await tx.query(
        `SELECT outstanding_points, settled_points, is_cancelled
           FROM point_recovery_claims WHERE id = $1 FOR UPDATE`,
        [claimRow.recovery_claim_id],
      );
      const claim = claims[0];
      if (claim && !claim.is_cancelled) {
        const outstanding = num(claim.outstanding_points);
        await tx.query(
          `UPDATE point_recovery_claims
              SET outstanding_points = 0, is_cancelled = true, cancelled_at = now()
            WHERE id = $1`,
          [claimRow.recovery_claim_id],
        );
        if (outstanding > 0) {
          await recordTransaction(tx, wallet, {
            kind: 'recovery_cancel',
            outstandingDelta: -outstanding,
            sourceType,
            sourceId,
            recoveryClaimId: claimRow.recovery_claim_id,
            key: `${keyBase}:cancel`,
          });
        }
        returned += num(claim.settled_points);
      }
    }
    if (recovery) returned += -num(recovery.available_delta);

    // 회수 때 복원했던 한도를 원 지급 월에서 되돌림
    const capCorrection = recovery ? -num(recovery.cap_delta) : 0;
    if (capCorrection > 0) {
      await lockUsage(tx, userId, recovery.cap_month);
      await addUsage(tx, userId, recovery.cap_month, {
        recovered: -capCorrection,
      });
    }
    if (returned > 0 || capCorrection > 0) {
      await recordTransaction(tx, wallet, {
        kind: 'reinstatement',
        availableDelta: returned,
        sourceType,
        sourceId,
        originalTransactionId: recovery?.id ?? null,
        capMonth: capCorrection > 0 ? recovery.cap_month : null,
        capDelta: capCorrection,
        key: keyBase,
      });
    }
    return { returnedPoints: returned, balance: wallet.available };
  }

  /** 원장 기준 현재 상태: 마지막 회수 계열 거래가 회수면 'revoked', 복구거나 없으면 'active' */
  async latestRecoveryEvent(tx, userId, sourceType, sourceId) {
    const { rows } = await tx.query(
      `SELECT kind FROM point_transactions
        WHERE user_id = $1 AND source_type = $2 AND source_id = $3
          AND kind IN ('recovery', 'recovery_claim', 'reinstatement', 'recovery_cancel')
        ORDER BY occurred_at DESC, id DESC
        LIMIT 1`,
      [userId, sourceType, sourceId],
    );
    const kind = rows[0]?.kind;
    return kind === 'recovery' || kind === 'recovery_claim'
      ? 'revoked'
      : 'active';
  }

  async findAutoAward(db, userId, sourceType, sourceId) {
    const { rows } = await db.query(
      `SELECT id, available_delta, cap_month FROM point_transactions
        WHERE user_id = $1 AND source_type = $2 AND source_id = $3
          AND kind = 'auto_award'`,
      [userId, sourceType, sourceId],
    );
    return rows[0] ?? null;
  }

  async requireMissionAward(tx, userId, missionId) {
    const award = await this.findMissionAward(tx, userId, missionId, true);
    if (!award) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'award_not_found',
        '지급 기록이 없는 미션',
      );
    }
    return award;
  }

  /**
   * 관리자 수동 조정(월 한도 제외), 호출 경로에서 감사 로그를 같은 트랜잭션에 남길 것
   * grant는 미회수액을 먼저 정산, recovery는 가용 잔액 안에서만 가능
   * (미회수 청구는 미션·챌린지 지급에만 연결할 수 있어 수동 회수의 부족분은 기록할 수 없음)
   */
  async manualAdjust(tx, { adminId, userId, kind, amount, reason }) {
    if (kind !== 'manual_grant' && kind !== 'manual_recovery') {
      throw new RangeError(`지원하지 않는 조정 종류: ${kind}`);
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError('amount는 양의 정수여야 함');
    }
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new RangeError('사유가 필요함');
    }

    const wallet = await lockWallet(tx, userId);
    const adjustmentId = randomUUID();
    const key = `admin_adjustment:${adjustmentId}`;
    const common = {
      sourceType: 'admin_adjustment',
      sourceId: adjustmentId,
      adminId,
      reason,
    };

    if (kind === 'manual_recovery') {
      if (amount > wallet.available) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'insufficient_points',
          '가용 포인트보다 많이 회수할 수 없음',
        );
      }
      await recordTransaction(tx, wallet, {
        ...common,
        kind,
        availableDelta: -amount,
        key,
      });
    } else {
      await recordTransaction(tx, wallet, {
        ...common,
        kind,
        availableDelta: amount,
        key,
      });
      await settleOutstanding(tx, wallet, {
        amount,
        kind: 'recovery_settlement',
        sourceType: 'admin_adjustment',
        sourceId: adjustmentId,
        key,
        adminId,
        reason,
      });
    }
    return {
      adjustmentId,
      balance: wallet.available,
      outstanding: wallet.outstanding,
    };
  }

  /**
   * 상점 주문 결제: 지갑을 잠그고 가용 잔액에서 차감(월 한도에는 포함하지 않음)
   * 지갑 → 주문 순서를 지키도록 호출자는 이 메서드를 먼저 부른 뒤 주문 행을 삽입
   * 반환: spend 거래 id (주문 삽입 트리거가 거래의 종류·금액·소스를 검증)
   */
  async spendForShopOrder(tx, { userId, orderId, amount }) {
    assertPoints(amount, 'amount');
    const wallet = await lockWallet(tx, userId);
    if (amount > wallet.available) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'insufficient_points',
        '포인트가 부족함',
      );
    }
    return recordTransaction(tx, wallet, {
      kind: 'spend',
      availableDelta: -amount,
      sourceType: 'shop_order',
      sourceId: orderId,
      key: `shop_order:${orderId}:spend`,
    });
  }

  /**
   * 상점 주문 환불: 원 spend 거래를 가리키는 refund 거래를 추가, 한도에는 포함하지 않음
   * 환불액으로 미회수액이 있으면 먼저 정산(refund_offset), 이미 지갑을 잠갔다면 다시 잠가도 같은 행
   * 반환: refund 거래 id
   */
  async refundShopOrder(tx, { userId, orderId, amount, spendTransactionId }) {
    assertPoints(amount, 'amount');
    const wallet = await lockWallet(tx, userId);
    const key = `shop_order:${orderId}:refund`;
    const refundId = await recordTransaction(tx, wallet, {
      kind: 'refund',
      availableDelta: amount,
      sourceType: 'shop_order',
      sourceId: orderId,
      originalTransactionId: spendTransactionId,
      key,
    });
    await settleOutstanding(tx, wallet, {
      amount,
      kind: 'refund_offset',
      sourceType: 'shop_order',
      sourceId: orderId,
      key,
    });
    return refundId;
  }

  async findMissionAward(db, userId, missionId, lock) {
    const { rows } = await db.query(
      `SELECT status, original_points, paid_points
         FROM mission_point_awards
        WHERE mission_id = $1 AND user_id = $2 ${lock ? 'FOR UPDATE' : ''}`,
      [missionId, userId],
    );
    return rows[0] ?? null;
  }

  existingAward(award, originalPoints) {
    if (num(award.original_points) !== originalPoints) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'reward_conflict',
        '이미 다른 금액으로 지급된 미션',
      );
    }
    return {
      outcome: 'already_applied',
      originalPoints,
      paidPoints: num(award.paid_points),
      status: award.status,
    };
  }

  async findByKey(db, key) {
    const { rows } = await db.query(
      `SELECT id, user_id, available_delta, cap_month
         FROM point_transactions WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ?? null;
  }

  async setAwardStatus(tx, missionId, status) {
    await tx.query(
      'UPDATE mission_point_awards SET status = $2, updated_at = now() WHERE mission_id = $1',
      [missionId, status],
    );
  }

  /** 지갑과 이번 달 한도 사용 현황, 지갑이 없으면 0 */
  /** 판정을 기다리는(제출한) 미션이 승인되면 받을 포인트 */
  async pendingPoints(db, userId) {
    const { rows } = await db.query(
      `SELECT coalesce(sum(reward_points), 0) AS n FROM missions
        WHERE user_id = $1 AND status = 'submitted' AND deleted_at IS NULL`,
      [userId],
    );
    return num(rows[0].n);
  }

  async getWallet(db, userId) {
    const [wallet, month] = await Promise.all([
      db.query(
        `SELECT available_points, outstanding_recovery_points
           FROM point_wallets WHERE user_id = $1`,
        [userId],
      ),
      currentMonth(db),
    ]);
    const [usage, limit] = await Promise.all([
      db.query(
        `SELECT gross_auto_awarded_points, same_month_recovered_points
           FROM point_monthly_usage
          WHERE user_id = $1 AND month_start_date = $2`,
        [userId, month],
      ),
      monthlyLimit(db, month),
    ]);
    const used = usage.rows[0]
      ? num(usage.rows[0].gross_auto_awarded_points) -
        num(usage.rows[0].same_month_recovered_points)
      : 0;
    return {
      availablePoints: wallet.rows[0]
        ? num(wallet.rows[0].available_points)
        : 0,
      outstandingRecoveryPoints: wallet.rows[0]
        ? num(wallet.rows[0].outstanding_recovery_points)
        : 0,
      month,
      monthlyLimit: limit,
      monthlyUsed: used,
      monthlyRemaining: Math.max(limit - used, 0),
      // 모바일 클라이언트(08 PointBalance) 키
      outstandingPoints: wallet.rows[0]
        ? num(wallet.rows[0].outstanding_recovery_points)
        : 0,
      pendingPoints: await this.pendingPoints(db, userId),
      monthlyEarnedPoints: used,
      monthlyLimitPoints: limit,
    };
  }

  /**
   * 거래 내역, 최신순 커서 페이지네이션
   * 커서는 마이크로초 정밀도를 유지하려고 occurred_at을 텍스트로 주고받음
   */
  async listTransactions(db, userId, { cursor, limit = 20 } = {}) {
    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.t !== 'string' || typeof after.id !== 'string') {
          throw new Error('invalid');
        }
      } catch {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'bad_request',
          '잘못된 cursor',
        );
      }
    }

    const { rows } = await db.query(
      `SELECT id, kind, available_delta, outstanding_delta, balance_after,
              outstanding_after, source_type, occurred_at,
              occurred_at::text AS occurred_at_raw
         FROM point_transactions
        WHERE user_id = $1
          AND ($2::timestamptz IS NULL OR (occurred_at, id) < ($2::timestamptz, $3::uuid))
        ORDER BY occurred_at DESC, id DESC
        LIMIT $4`,
      [userId, after?.t ?? null, after?.id ?? null, limit + 1],
    );

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        id: row.id,
        kind: row.kind,
        availableDelta: num(row.available_delta),
        outstandingDelta: num(row.outstanding_delta),
        balanceAfter: num(row.balance_after),
        outstandingAfter: num(row.outstanding_after),
        sourceType: row.source_type,
        occurredAt: row.occurred_at,
      })),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({ t: last.occurred_at_raw, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
}
