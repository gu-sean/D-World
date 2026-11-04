import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AchievementsService } from '../achievements/achievements.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { addDays, kstDayStart } from '../common/time/kst.js';
import { ExperienceService } from '../experience-pets/experience.service.js';
import { GoalsService } from '../goals/goals.service.js';
import { ScoringService } from '../challenges/scoring.service.js';
import { StreakService } from '../streak/streak.service.js';
import { PointsService } from '../points/points.service.js';
import { MissionOutcomeNotifier } from './mission-outcome.notifier.js';
import { MAX_SUBMISSIONS } from './records/records.constants.js';

const num = (value) => Number(value);

const recordNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'record_not_found',
    '수행 회차를 찾을 수 없음',
  );

// 판정을 새로 넣거나 다시 매길 수 있는 회차 상태 (포기·진행 중·superseded는 제외)
const JUDGEABLE = ['submitted', 'review_required', 'approved', 'rejected'];

const RECORD_STATUS_BY_DECISION = {
  approved: 'approved',
  rejected: 'rejected',
  review_required: 'review_required',
};

/**
 * 판정 반영 (3-C-3)
 * 모든 판정(AI, 관리자 보류 검수, 이의 제기 처리)이 이 함수를 거치며, 현재 판정 교체·회차와 미션 상태·
 * 포인트·XP·업적·단계 재평가가 호출자가 연 하나의 트랜잭션 안에서 반영
 * 잠금 순서: 미션 → 회차 → (포인트 지급 행 → 지갑 → 월간 사용량) → 사용자 XP → 펫 → 업적
 */
@Injectable()
@Dependencies(
  PointsService,
  ExperienceService,
  AchievementsService,
  GoalsService,
  MissionOutcomeNotifier,
  StreakService,
  ScoringService,
)
export class DecisionService {
  constructor(
    points,
    experience,
    achievements,
    goals,
    notifier,
    streak,
    challengeScoring,
  ) {
    this.points = points;
    this.experience = experience;
    this.achievements = achievements;
    this.goals = goals;
    this.notifier = notifier;
    this.streak = streak;
    this.challengeScoring = challengeScoring;
  }

  /** 미션 전체에서 현재 판정이 승인인 회차가 있는지 */
  async hasValidApproval(tx, missionId) {
    const { rows } = await tx.query(
      `SELECT EXISTS (
         SELECT 1 FROM verification_results vr
           JOIN mission_records mr ON mr.id = vr.record_id
          WHERE mr.mission_id = $1 AND vr.is_current AND vr.decision = 'approved') AS valid`,
      [missionId],
    );
    return rows[0].valid;
  }

  /** 미션의 카테고리·인증 방식에 맞고 지금 시행 중인 가장 최근 판정 기준, 지정한 id가 있으면 그것이 맞는지 확인 */
  async resolveCriteria(tx, mission, requestedId) {
    const { rows } = await tx.query(
      `SELECT id FROM verification_criteria_versions
        WHERE category_id = $1 AND verification_method = $2 AND effective_at <= now()
        ORDER BY effective_at DESC, version_no DESC`,
      [mission.category_id, mission.verification_method],
    );
    if (rows.length === 0) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'criteria_missing',
        '이 카테고리와 인증 방식에 적용할 판정 기준이 없음',
      );
    }
    if (requestedId === undefined) return rows[0].id;
    if (!rows.some((row) => row.id === requestedId)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'criteria_mismatch',
        '이 미션에 적용할 수 없는 판정 기준',
      );
    }
    return requestedId;
  }

  /**
   * input: { recordId, source: 'ai'|'admin', decision, engineVersion?, confidence?, metrics?, reason?,
   *          adminId?, ingestKey?, rawResult?, criteriaVersionId?,
   *          allowedStatuses?, ignoreIfNotJudgeable? }
   * 반환: { outcome: 'applied'|'duplicate'|'ignored', resultId?, resultNo?, decision?, transition?, missionStatus?, ... }
   *   transition: 'completed'(유효한 승인이 생김), 'revoked'(사라짐), 'history'(다른 회차에 유효한 승인이 있어 이력만), 'none'
   */
  async applyDecision(tx, input) {
    const { recordId, source, decision } = input;
    if (source === 'admin' && (!input.adminId || !input.reason?.trim())) {
      throw new RangeError('관리자 판정에는 adminId와 사유가 필요함');
    }
    if (source === 'ai' && !input.engineVersion) {
      throw new RangeError('AI 판정에는 engineVersion이 필요함');
    }

    // 1) 미션 → 회차 순서로 잠금
    const { rows: probe } = await tx.query(
      'SELECT mission_id FROM mission_records WHERE id = $1',
      [recordId],
    );
    if (!probe[0]) throw recordNotFound();
    const { rows: missions } = await tx.query(
      `SELECT id, user_id, status, source_type, verification_method, category_id, goal_step_id,
              scheduled_date, due_at, reward_points, reward_user_xp, reward_pet_xp
         FROM missions WHERE id = $1 FOR UPDATE`,
      [probe[0].mission_id],
    );
    const mission = missions[0];
    const { rows: records } = await tx.query(
      `SELECT id, mission_id, user_id, status, submission_no, reward_pet_id,
              reward_pet_stage_no, reward_pet_bonus_basis_points
         FROM mission_records WHERE id = $1 FOR UPDATE`,
      [recordId],
    );
    const record = records[0];

    // 2) AI 결과 재전송은 처음 결과를 그대로 반환
    if (input.ingestKey) {
      const { rows } = await tx.query(
        'SELECT id, record_id, result_no, decision FROM verification_results WHERE ingest_key = $1',
        [input.ingestKey],
      );
      if (rows[0]) {
        if (rows[0].record_id !== recordId) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'ingest_key_reused',
            '같은 ingestKey로 다른 회차의 결과를 보냄',
          );
        }
        return {
          outcome: 'duplicate',
          resultId: rows[0].id,
          resultNo: rows[0].result_no,
          decision: rows[0].decision,
        };
      }
    }

    // 3) 판정할 수 있는 회차 상태인지
    const allowed = input.allowedStatuses ?? JUDGEABLE;
    if (record.submission_no === null || !allowed.includes(record.status)) {
      if (input.ignoreIfNotJudgeable) {
        return { outcome: 'ignored', recordStatus: record.status };
      }
      throw new AppException(
        HttpStatus.CONFLICT,
        'record_not_reviewable',
        '판정을 반영할 수 없는 회차 상태',
        { details: { status: record.status } },
      );
    }

    const criteriaId = await this.resolveCriteria(
      tx,
      mission,
      input.criteriaVersionId,
    );
    const wasValid = await this.hasValidApproval(tx, mission.id);

    // 4) 현재 판정 교체: 이전 판정의 is_current를 먼저 내리고 새 판정을 넣음(회차당 현재 판정 1건)
    const { rows: previous } = await tx.query(
      `SELECT id, result_no FROM verification_results
        WHERE record_id = $1 ORDER BY result_no DESC LIMIT 1`,
      [recordId],
    );
    await tx.query(
      'UPDATE verification_results SET is_current = false WHERE record_id = $1 AND is_current',
      [recordId],
    );
    const resultId = randomUUID();
    const resultNo = (previous[0]?.result_no ?? 0) + 1;
    await tx.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision, criteria_version_id, engine_version,
               confidence, metrics, reason, reviewed_by_admin_id, ingest_key, raw_result,
               decided_at, notified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb, now(),
               CASE WHEN $14::text = 'review_required' THEN NULL ELSE now() END)`,
      [
        resultId,
        recordId,
        resultNo,
        source,
        decision,
        criteriaId,
        source === 'ai' ? input.engineVersion : null,
        input.confidence ?? null,
        input.metrics ? JSON.stringify(input.metrics) : null,
        input.reason || null,
        source === 'admin' ? input.adminId : null,
        input.ingestKey ?? null,
        input.rawResult ? JSON.stringify(input.rawResult) : null,
        decision,
      ],
    );
    await tx.query(
      `UPDATE mission_records
          SET status = $2,
              completed_at = CASE WHEN $3::text IN ('approved', 'rejected') THEN now() ELSE completed_at END
        WHERE id = $1`,
      [recordId, RECORD_STATUS_BY_DECISION[decision], decision],
    );

    const isValid = await this.hasValidApproval(tx, mission.id);
    const result = {
      outcome: 'applied',
      resultId,
      resultNo,
      decision,
      transition: 'none',
    };

    if (!wasValid && isValid) {
      await this.onBecameValid(tx, mission, record, resultId);
      result.transition = 'completed';
    } else if (wasValid && !isValid) {
      await this.onBecameInvalid(tx, mission, resultId);
      result.transition = 'revoked';
    } else if (wasValid && isValid) {
      // 다른 회차에 유효한 승인이 있어 보상과 미션 상태는 그대로, 이력만 남김
      result.transition = 'history';
    } else {
      await this.setOpenStatus(tx, mission);
    }

    if (wasValid !== isValid) {
      await this.notifier.notify(tx, {
        userId: mission.user_id,
        missionId: mission.id,
        scheduledDate: mission.scheduled_date,
        hasValidApproval: isValid,
      });
    }
    if (mission.goal_step_id && wasValid !== isValid) {
      await this.goals.reevaluateStep(tx, mission.goal_step_id);
    }

    // 챌린지 미션이면 그 참가의 일별 결과를 다시 계산(승인 여부가 안 바뀌어도 pending·근거 판정이 달라질 수 있음)
    await this.challengeScoring.onDecisionApplied(tx, {
      missionId: mission.id,
    });
    // 승인 여부가 안 바뀌어도 그날의 근거 판정·대기(pending) 여부가 달라질 수 있어 항상 다시 평가
    await this.streak.onDecisionApplied(tx, {
      userId: mission.user_id,
      scheduledDate: mission.scheduled_date,
    });

    const { rows: after } = await tx.query(
      'SELECT status FROM missions WHERE id = $1',
      [mission.id],
    );
    result.missionStatus = after[0].status;
    return result;
  }

  /** 유효한 승인이 처음(또는 번복 뒤 다시) 생김: 미션 완료, 다른 회차 종료, 보상 지급·복구, 업적 */
  async onBecameValid(tx, mission, record, resultId) {
    await tx.query(
      `UPDATE missions SET status = 'completed', updated_at = now() WHERE id = $1`,
      [mission.id],
    );
    // 판정 대기 중이던 다른 회차는 검수 대기에서 빼고 종료
    await tx.query(
      `UPDATE mission_records SET status = 'superseded', completed_at = now()
        WHERE mission_id = $1 AND id <> $2 AND status IN ('submitted', 'review_required')`,
      [mission.id, record.id],
    );

    // 챌린지 미션은 자체 보상이 없다(완주 보상은 정산 때 한 번)
    if (mission.source_type === 'challenge') return;

    const userId = mission.user_id;
    const { rows: pointAward } = await tx.query(
      'SELECT status FROM mission_point_awards WHERE mission_id = $1 AND user_id = $2',
      [mission.id, userId],
    );
    if (!pointAward[0]) {
      await this.points.awardMissionPoints(tx, {
        userId,
        missionId: mission.id,
        resultId,
        originalPoints: mission.reward_points,
      });
    } else if (pointAward[0].status === 'revoked') {
      await this.points.reinstateMissionPoints(tx, {
        userId,
        missionId: mission.id,
        resultId,
      });
    }

    const awardId = await this.experience.findAwardId(
      tx,
      userId,
      'mission',
      mission.id,
    );
    if (!awardId) {
      // 수령 펫은 승인된 회차를 시작할 때 DB 트리거가 고정해 둔 값, 대표 펫이 없었으면 보류 XP
      await this.experience.awardExperience(tx, {
        userId,
        sourceType: 'mission',
        sourceId: mission.id,
        userXp: mission.reward_user_xp,
        basePetXp: mission.reward_pet_xp,
        recipient: record.reward_pet_id
          ? {
              petId: record.reward_pet_id,
              stageNo: record.reward_pet_stage_no,
              bonusBasisPoints: record.reward_pet_bonus_basis_points,
            }
          : null,
      });
    } else {
      await this.experience.reinstateExperience(tx, { awardId, resultId });
    }

    await this.achievements.evaluate(tx, {
      userId,
      trigger: 'mission_approved',
    });
  }

  /** 유효한 승인이 사라짐: 보상 회수, 업적 재검사, 미션을 재시도 가능 여부에 따라 되돌림 */
  async onBecameInvalid(tx, mission, resultId) {
    if (mission.source_type === 'challenge') {
      await this.setOpenStatus(tx, mission);
      return;
    }
    const userId = mission.user_id;
    const { rows: pointAward } = await tx.query(
      'SELECT status FROM mission_point_awards WHERE mission_id = $1 AND user_id = $2',
      [mission.id, userId],
    );
    if (pointAward[0]?.status === 'active') {
      await this.points.revokeMissionPoints(tx, {
        userId,
        missionId: mission.id,
        resultId,
      });
    }
    const awardId = await this.experience.findAwardId(
      tx,
      userId,
      'mission',
      mission.id,
    );
    if (awardId)
      await this.experience.revokeExperience(tx, { awardId, resultId });
    await this.achievements.evaluate(tx, { userId, trigger: 'revoked' });

    await this.setOpenStatus(tx, mission);
  }

  /**
   * 완료 상태가 아닌 미션의 상태 결정
   * 판정 대기 중인 회차가 있으면 submitted, 없으면 남은 제출 횟수와 마감을 보고 in_progress(재시도 가능) 또는 failed
   */
  async setOpenStatus(tx, mission) {
    const { rows } = await tx.query(
      `SELECT count(*) FILTER (WHERE status IN ('submitted', 'review_required')) AS waiting,
              count(*) FILTER (WHERE submission_no IS NOT NULL) AS submitted
         FROM mission_records WHERE mission_id = $1`,
      [mission.id],
    );
    const deadline = mission.due_at
      ? new Date(mission.due_at)
      : kstDayStart(addDays(mission.scheduled_date, 1));
    let status;
    if (num(rows[0].waiting) > 0) status = 'submitted';
    else if (
      num(rows[0].submitted) < MAX_SUBMISSIONS &&
      Date.now() <= deadline.getTime()
    ) {
      status = 'in_progress';
    } else status = 'failed';

    await tx.query(
      `UPDATE missions SET status = $2, updated_at = now() WHERE id = $1`,
      [mission.id, status],
    );
  }
}
