import { randomUUID } from 'node:crypto';

/**
 * 경험치 원장 내부 도구, 호출자가 연 트랜잭션(tx)에서만 사용
 * 레벨·단계는 DB 트리거(user_experience_guard, user_pets_guard)가 다시 검증하므로
 * 여기 계산은 그 트리거와 같은 쿼리를 그대로 따라야 함(docs/database/14 참고)
 */

const toNumber = (value) => Number(value);

/** 해당 시각에 이미 발효된 레벨 정책 중 가장 최근 버전(불변, 계정에 고정해 사용) */
export async function latestPolicy(tx, table) {
  const { rows } = await tx.query(
    `SELECT id FROM ${table} WHERE effective_at <= now()
      ORDER BY effective_at DESC LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

/** total_xp 이하인 가장 높은 임곗값의 레벨, table은 고정 문자열만 전달 */
export async function computeLevel(tx, table, policyVersionId, totalXp) {
  const { rows } = await tx.query(
    `SELECT max(level_no) AS level FROM ${table}
      WHERE policy_version_id = $1 AND min_total_xp <= $2`,
    [policyVersionId, totalXp],
  );
  return rows[0].level;
}

/**
 * 펫 단계: user_pets_guard 트리거가 계산하는 식과 동일
 * (XP 임곗값 + 알 선택 후 시작한 해당 속성 승인 미션 수)
 */
export async function computeStage(
  tx,
  { speciesVersionId, userId, selectedAt },
  totalXp,
) {
  const { rows } = await tx.query(
    `SELECT
       (SELECT min_total_xp FROM pet_stage_versions
         WHERE species_version_id = $1 AND stage_no = 2) AS baby_xp,
       (SELECT min_total_xp FROM pet_stage_versions
         WHERE species_version_id = $1 AND stage_no = 3) AS adult_xp,
       (SELECT hatch_mission_count FROM pet_species_versions WHERE id = $1) AS hatch_required,
       (SELECT count(DISTINCT m.id) FROM missions m
          JOIN mission_records mr ON mr.mission_id = m.id
          JOIN verification_results vr ON vr.record_id = mr.id
          JOIN pet_species_versions psv ON psv.id = $1
         WHERE m.user_id = $2 AND m.category_id = psv.category_id
           AND m.status = 'completed' AND mr.started_at >= $3
           AND vr.decision = 'approved' AND vr.is_current) AS actual_count`,
    [speciesVersionId, userId, selectedAt],
  );
  const r = rows[0];
  const babyXp = toNumber(r.baby_xp);
  const adultXp = toNumber(r.adult_xp);
  const hatchRequired = toNumber(r.hatch_required);
  const actualCount = toNumber(r.actual_count);
  if (totalXp < babyXp || actualCount < hatchRequired) return 1;
  if (totalXp < adultXp) return 2;
  return 3;
}

/** 사용자 XP 계정 잠금, 없으면 활성 정책을 고정해 0 XP로 생성 */
export async function lockUserExperience(tx, userId, onMissingPolicy) {
  const { rows } = await tx.query(
    `SELECT level_policy_version_id, total_xp, level_no
       FROM user_experience WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  if (rows[0]) {
    return {
      userId,
      levelPolicyVersionId: rows[0].level_policy_version_id,
      totalXp: toNumber(rows[0].total_xp),
      levelNo: rows[0].level_no,
    };
  }
  const policyVersionId = await latestPolicy(tx, 'user_level_policy_versions');
  if (!policyVersionId) return onMissingPolicy();
  await tx.query(
    `INSERT INTO user_experience (user_id, level_policy_version_id, total_xp, level_no)
     VALUES ($1, $2, 0, 1) ON CONFLICT DO NOTHING`,
    [userId, policyVersionId],
  );
  const { rows: created } = await tx.query(
    `SELECT level_policy_version_id, total_xp, level_no
       FROM user_experience WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  return {
    userId,
    levelPolicyVersionId: created[0].level_policy_version_id,
    totalXp: toNumber(created[0].total_xp),
    levelNo: created[0].level_no,
  };
}

/** 펫 행 잠금, ownerUserId가 있으면 소유자 일치까지 확인 */
export async function lockPet(tx, petId) {
  const { rows } = await tx.query(
    `SELECT id, user_id, species_version_id, level_policy_version_id,
            selected_at, total_xp, level_no, stage_no
       FROM user_pets WHERE id = $1 FOR UPDATE`,
    [petId],
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    userId: rows[0].user_id,
    speciesVersionId: rows[0].species_version_id,
    levelPolicyVersionId: rows[0].level_policy_version_id,
    selectedAt: rows[0].selected_at,
    totalXp: toNumber(rows[0].total_xp),
    levelNo: rows[0].level_no,
    stageNo: rows[0].stage_no,
  };
}

/** 경험치 거래 삽입(추가만 가능), id 반환 */
export async function insertExperienceTransaction(
  tx,
  {
    userId,
    recipientKind,
    userPetId = null,
    experienceAwardId = null,
    xpDelta,
    balanceAfter,
    kind,
    originalTransactionId = null,
    key,
    adminId = null,
    reason = null,
  },
) {
  const id = randomUUID();
  await tx.query(
    `INSERT INTO experience_transactions
            (id, user_id, recipient_kind, user_pet_id, experience_award_id,
             xp_delta, balance_after, kind, original_transaction_id,
             idempotency_key, created_by_admin_id, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      userId,
      recipientKind,
      userPetId,
      experienceAwardId,
      xpDelta,
      balanceAfter,
      kind,
      originalTransactionId,
      key,
      adminId,
      reason,
    ],
  );
  return id;
}

/** award 계열 외 거래(reversal/reinstatement)에서 되돌릴 원 거래 id */
export async function findOriginalTransaction(
  tx,
  { experienceAwardId, recipientKind, kind },
) {
  const { rows } = await tx.query(
    `SELECT id FROM experience_transactions
      WHERE experience_award_id = $1 AND recipient_kind = $2 AND kind = $3
      ORDER BY occurred_at DESC, id DESC LIMIT 1`,
    [experienceAwardId, recipientKind, kind],
  );
  return rows[0]?.id ?? null;
}
