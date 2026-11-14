import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ActiveAccountGuard } from '../accounts/active-account.guard.js';
import { AppException } from '../common/errors/app-exception.js';
import { addDays, kstDate, kstDayStart } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { GoalsService } from '../goals/goals.service.js';
import {
  MAX_MISSIONS_PER_DAY,
  MAX_SCHEDULE_AHEAD_DAYS,
} from './missions.constants.js';
import { RewardResolver } from './reward-resolver.js';
import { assessDifficulty, difficultyName } from './difficulty-rules.js';
import { conflict, unprocessable } from '../common/errors/http-errors.js';

const num = (value) => Number(value);

const MAX_SUBMISSIONS = 4;
const GUIDES = {
  push_up: '몸이 일직선이 되도록 옆모습이 화면에 들어오게 기기를 세워 주세요.',
  burpee: '온몸이 화면에 들어오도록 2~3m 떨어진 곳에 기기를 세워 주세요.',
  squat: '온몸이 화면에 들어오도록 2~3m 떨어진 곳에 기기를 세워 주세요.',
  lunge: '온몸이 화면에 들어오도록 2~3m 떨어진 곳에 기기를 세워 주세요.',
  plank: '옆모습 전체가 보이도록 기기를 낮게 세워 주세요.',
  running: '러닝 앱 화면을 켜 둔 채 휴대폰을 가지고 달려 주세요.',
};

const missionNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'mission_not_found',
    '미션을 찾을 수 없음',
  );
const definitionNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'definition_not_found',
    '사용할 수 없는 미션 원형',
  );
const stepNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'step_not_found',
    '단계를 찾을 수 없음',
  );
const badRequest = (message) =>
  new AppException(HttpStatus.BAD_REQUEST, 'bad_request', message);

const COLUMNS = `id, user_id, goal_id, goal_step_id, definition_id, source_type, title,
  description, category_id, difficulty_id, target_value, target_unit,
  estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required,
  exercise_code, status, memo, cancel_reason, cancelled_at, reward_points, reward_user_xp, reward_pet_xp,
  created_at, updated_at`;

// PATCH로 바꿀 수 있는 컬럼(쿼리에 들어가므로 고정 목록만 사용)
const PATCH_COLUMNS = {
  title: 'title',
  description: 'description',
  targetValue: 'target_value',
  targetUnit: 'target_unit',
  estimatedDurationSeconds: 'estimated_duration_seconds',
  verificationMethod: 'verification_method',
  scheduledDate: 'scheduled_date',
  dueAt: 'due_at',
  isRequired: 'is_required',
  stepId: 'goal_step_id',
  memo: 'memo',
};

/** 예정일 다음 날 00:00(KST), 스트릭 귀속 마감과 같은 기준 */
const defaultDueAt = (date) => kstDayStart(addDays(date, 1)).toISOString();

/**
 * 미션 생성·조회·수정·취소·삭제
 * 수행 시작·인증·판정은 VerificationModule. 보상(reward_*)은 생성 시 확정, 이후 불변
 */
@Injectable()
@Dependencies(DatabaseService, GoalsService, RewardResolver, ActiveAccountGuard)
export class MissionsService {
  constructor(database, goals, rewards, activeGuard) {
    this.database = database;
    this.goals = goals;
    this.rewards = rewards;
    this.activeGuard = activeGuard;
  }

  toView(row) {
    return {
      id: row.id,
      goalId: row.goal_id,
      stepId: row.goal_step_id,
      goalStepId: row.goal_step_id,
      challengeId: null,
      exerciseCode: row.exercise_code ?? null,
      definitionId: row.definition_id,
      sourceType: row.source_type,
      title: row.title,
      description: row.description,
      categoryId: row.category_id,
      difficultyId: row.difficulty_id,
      targetValue: row.target_value === null ? null : num(row.target_value),
      targetUnit: row.target_unit,
      estimatedDurationSeconds: row.estimated_duration_seconds,
      verificationMethod: row.verification_method,
      scheduledDate: row.scheduled_date,
      dueAt: row.due_at,
      isRequired: row.is_required,
      status: row.status,
      memo: row.memo,
      cancelReason: row.cancel_reason,
      cancelledAt: row.cancelled_at,
      reward: {
        points: row.reward_points,
        userXp: row.reward_user_xp,
        petXp: row.reward_pet_xp,
      },
      rewardPreview: {
        points: row.reward_points,
        userXp: row.reward_user_xp,
        petXp: row.reward_pet_xp,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** 예정일 규칙: 오늘(KST) 이상, 오늘부터 366일 이내, 연결한 목표의 기간 안 */
  assertDates(dates, goal) {
    const today = kstDate();
    const latest = addDays(today, MAX_SCHEDULE_AHEAD_DAYS);
    for (const date of dates) {
      let reason = null;
      if (date < today) reason = 'past';
      else if (date > latest) reason = 'too_far';
      else if (goal && (date < goal.start_date || date > goal.end_date)) {
        reason = 'outside_goal_period';
      }
      if (reason) {
        throw unprocessable('date_out_of_range', '예정일을 사용할 수 없음', {
          date,
          reason,
        });
      }
    }
  }

  assertDueAt(dueAt, date) {
    const due = Date.parse(dueAt);
    if (
      due <= kstDayStart(date).getTime() ||
      due > kstDayStart(addDays(date, 1)).getTime()
    ) {
      throw unprocessable('invalid_due_at', '마감 시각은 예정일 안이어야 함', {
        date,
      });
    }
  }

  /** 날짜별 미션 수 상한, 호출 전에 사용자 행을 잠가 동시 생성을 직렬화해야 함 */
  async assertDailyCapacity(
    tx,
    userId,
    dates,
    { excludeMissionId = null } = {},
  ) {
    return this.assertCapacityCounts(
      tx,
      userId,
      new Map(dates.map((date) => [date, 1])),
      { excludeMissionId },
    );
  }

  /**
   * 날짜별로 새로 만들 개수(counts: date → n)를 더해도 상한을 넘지 않는지
   * AI 제안 수락처럼 같은 날짜에 여러 개를 한 번에 생성할 때 사용
   */
  async assertCapacityCounts(
    tx,
    userId,
    counts,
    { excludeMissionId = null } = {},
  ) {
    const dates = [...counts.keys()];
    const { rows } = await tx.query(
      `SELECT scheduled_date, count(*) AS n FROM missions
        WHERE user_id = $1 AND scheduled_date = ANY($2::date[])
          AND deleted_at IS NULL AND status <> 'cancelled' AND source_type <> 'challenge'
          AND ($3::short_id IS NULL OR id <> $3)
        GROUP BY scheduled_date`,
      [userId, dates, excludeMissionId],
    );
    const existing = new Map(rows.map((r) => [r.scheduled_date, num(r.n)]));
    for (const date of dates) {
      if ((existing.get(date) ?? 0) + counts.get(date) > MAX_MISSIONS_PER_DAY) {
        throw conflict(
          'daily_limit_reached',
          `하루 미션은 최대 ${MAX_MISSIONS_PER_DAY}개`,
          {
            date,
          },
        );
      }
    }
  }

  /** 쓸 수 있는 원형: 공개(관리자 템플릿 포함) 또는 내가 만든 것, 숨김·삭제 제외 */
  async loadDefinition(db, userId, definitionId) {
    const { rows } = await db.query(
      `SELECT id, origin, title, description, category_id, difficulty_id, target_value,
              target_unit, estimated_duration_seconds, verification_method,
              base_points, base_user_xp, base_pet_xp, exercise_code
         FROM mission_definitions
        WHERE id = $1 AND deleted_at IS NULL AND publication_status <> 'hidden'
          AND (publication_status = 'public' OR created_by_user_id = $2)`,
      [definitionId, userId],
    );
    if (!rows[0]) throw definitionNotFound();
    return rows[0];
  }

  async loadStepOf(db, goalId, stepId) {
    const { rows } = await db.query(
      'SELECT id FROM goal_steps WHERE id = $1 AND goal_id = $2',
      [stepId, goalId],
    );
    if (!rows[0]) throw stepNotFound();
  }

  /**
   * 미션 생성: 날짜마다 별도 행, 한 트랜잭션(하나라도 실패하면 전부 롤백)
   * input.definitionId가 있으면 원형을 복사하는 템플릿 생성, 없으면 직접 생성
   */
  async createMissions(userId, input) {
    const dates = [...new Set(input.scheduledDates)].sort();
    if (input.dueAt !== undefined && dates.length !== 1) {
      throw badRequest('dueAt은 예정일이 하나일 때만 지정할 수 있음');
    }
    if (input.stepId && !input.goalId) {
      throw badRequest('stepId에는 goalId가 필요함');
    }

    return this.database.withTransaction(async (tx) => {
      // 같은 사용자의 동시 생성이 하루 상한 검사를 함께 통과하지 못하게 직렬화
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);

      let goal = null;
      if (input.goalId) {
        goal = await this.goals.loadGoal(tx, userId, input.goalId, {
          lock: true,
        });
        if (goal.status === 'completed') {
          throw conflict(
            'goal_completed',
            '완료된 목표에는 미션을 추가할 수 없음',
          );
        }
        if (goal.status === 'paused') {
          throw conflict(
            'goal_paused',
            '일시정지된 목표에는 미션을 추가할 수 없음',
          );
        }
        if (input.stepId) await this.loadStepOf(tx, input.goalId, input.stepId);
      }

      let definition = null;
      let spec;
      if (input.definitionId) {
        definition = await this.loadDefinition(tx, userId, input.definitionId);
        spec = {
          title: definition.title,
          description: definition.description,
          categoryId: definition.category_id,
          difficultyId: definition.difficulty_id,
          targetValue:
            definition.target_value === null
              ? null
              : num(definition.target_value),
          targetUnit: definition.target_unit,
          estimatedDurationSeconds: definition.estimated_duration_seconds,
          verificationMethod: definition.verification_method,
          exerciseCode: definition.exercise_code ?? null,
        };
      } else {
        spec = {
          title: input.title,
          description: input.description || null,
          // 목표에 연결하면 분야를 생략해 목표의 값을 씀
          categoryId: input.categoryId ?? goal?.category_id,
          // 난이도는 사용자가 고르지 않는다: 미션 내용으로 규칙 판정 (보상은 미션마다, difficulty-rules.js)
          difficultyId: null,
          targetValue: input.targetValue ?? null,
          targetUnit: input.targetUnit ?? null,
          estimatedDurationSeconds: input.estimatedDurationSeconds ?? null,
          // 생략하면 DB 제약(exercise_code='running' ⇔ sensor)에 맞춰 러닝만 sensor, 그 밖은 camera
          verificationMethod:
            input.verificationMethod ??
            (input.exerciseCode === 'running' ? 'sensor' : 'camera'),
          exerciseCode: input.exerciseCode ?? null,
        };
        spec.difficultyId = await this.difficultyIdOf(
          tx,
          assessDifficulty(spec).difficultyCode,
        );
        if (!spec.categoryId) {
          throw badRequest('categoryId가 필요함(목표에 연결하면 생략 가능)');
        }
        if ((spec.targetValue === null) !== (spec.targetUnit === null)) {
          throw badRequest('targetValue와 targetUnit은 함께 지정해야 함');
        }
      }

      await this.goals.assertReferences(tx, spec.categoryId, spec.difficultyId);
      this.assertDates(dates, goal);
      if (input.dueAt !== undefined) this.assertDueAt(input.dueAt, dates[0]);
      await this.assertDailyCapacity(tx, userId, dates);

      // 보상은 한 번 구해 모든 날짜에 같은 값을 복사
      const reward = await this.rewards.resolve(tx, {
        definition,
        categoryId: spec.categoryId,
        difficultyId: spec.difficultyId,
      });

      const created = [];
      for (const date of dates) {
        created.push(
          await this.insertMissionRow(tx, userId, {
            goalId: input.goalId ?? null,
            stepId: input.stepId ?? null,
            definitionId: definition?.id ?? null,
            sourceType: definition ? 'template' : 'user',
            ...spec,
            scheduledDate: date,
            dueAt: input.dueAt ?? defaultDueAt(date),
            isRequired: input.isRequired ?? true,
            memo: input.memo || null,
            reward,
          }),
        );
      }

      // 완료된 단계에 필수 미션이 추가되면 다시 열림
      if (input.stepId) await this.goals.reevaluateStep(tx, input.stepId);
      return created;
    });
  }

  /** 난이도 code → id */
  async difficultyIdOf(db, code) {
    const { rows } = await db.query(
      'SELECT id FROM difficulty_levels WHERE code = $1',
      [code],
    );
    if (!rows[0]) throw new Error(`난이도 ${code}가 없음`);
    return rows[0].id;
  }

  /**
   * 미션을 만들기 전에 판정될 난이도와 보상을 미리 보여 줌 (저장하지 않음)
   * categoryId가 없으면 goalId의 분야를 씀
   */
  async previewDifficulty(userId, input) {
    const judged = assessDifficulty(input);
    return this.database.withTransaction(async (tx) => {
      let categoryId = input.categoryId ?? null;
      if (!categoryId && input.goalId) {
        categoryId = (await this.goals.loadGoal(tx, userId, input.goalId))
          .category_id;
      }
      let rewardPoints = null;
      if (categoryId) {
        const reward = await this.rewards.resolve(tx, {
          categoryId,
          difficultyId: await this.difficultyIdOf(tx, judged.difficultyCode),
        });
        rewardPoints = reward.points;
      }
      return {
        difficultyCode: judged.difficultyCode,
        difficultyName: difficultyName(judged.difficultyCode),
        reason: judged.reason,
        rewardPoints,
      };
    });
  }

  /**
   * 미션 행 한 건 삽입, 직접·템플릿 생성과 AI 제안 수락이 공유
   * 보상(reward)은 호출자가 RewardResolver로 구한 값을 넘기며 이후 DB 트리거가 수정을 막음
   * sourceProposalId는 AI 미션일 때만, 그 제안은 같은 트랜잭션에서 먼저 accepted여야 함
   */
  async insertMissionRow(tx, userId, m) {
    const { rows } = await tx.query(
      `INSERT INTO missions
              (id, user_id, goal_id, goal_step_id, definition_id, source_type,
               source_proposal_id, title, description, category_id, difficulty_id,
               target_value, target_unit, estimated_duration_seconds, verification_method,
               scheduled_date, due_at, is_required, memo, reward_points,
               reward_rate_version_id, reward_user_xp, reward_pet_xp, exercise_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING ${COLUMNS}`,
      [
        newId(),
        userId,
        m.goalId ?? null,
        m.stepId ?? null,
        m.definitionId ?? null,
        m.sourceType,
        m.sourceProposalId ?? null,
        m.title,
        m.description ?? null,
        m.categoryId,
        m.difficultyId,
        m.targetValue ?? null,
        m.targetUnit ?? null,
        m.estimatedDurationSeconds ?? null,
        m.verificationMethod,
        m.scheduledDate,
        m.dueAt,
        m.isRequired,
        m.memo ?? null,
        m.reward.points,
        m.reward.rateVersionId,
        m.reward.userXp,
        m.reward.petXp,
        m.exerciseCode ?? null,
      ],
    );
    return this.toView(rows[0]);
  }

  /** 특정 AI 제안으로 만든 미션(취소 이력 포함), 이미 수락한 제안의 결과를 다시 보여 줄 때 사용 */
  async listByProposal(db, userId, proposalId) {
    const { rows } = await db.query(
      `SELECT ${COLUMNS} FROM missions
        WHERE user_id = $1 AND source_proposal_id = $2
        ORDER BY scheduled_date, created_at, id`,
      [userId, proposalId],
    );
    return rows.map((row) => this.toView(row));
  }

  /** 소유자 확인과 함께 미션 한 건 조회(삭제된 미션 제외), lock이면 행 잠금 */
  /** 챌린지 전용 미션은 사용자가 수정·취소·삭제 불가(챌린지가 관리) */
  assertNotChallenge(mission) {
    if (mission.source_type === 'challenge') {
      throw conflict(
        'challenge_mission_locked',
        '챌린지 미션은 직접 수정·취소·삭제할 수 없음(챌린지 포기로 정리됨)',
      );
    }
  }

  async loadMission(db, userId, missionId, { lock = false } = {}) {
    const { rows } = await db.query(
      `SELECT ${COLUMNS} FROM missions
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
      [missionId, userId],
    );
    if (!rows[0]) throw missionNotFound();
    return rows[0];
  }

  async getMission(userId, missionId) {
    return this.toView(
      await this.loadMission(this.database, userId, missionId),
    );
  }

  /**
   * 내 미션 목록: 예정일, 이름순이 아니라 (예정일, 생성순) 오름차순 커서
   * 기본은 취소·삭제 제외, status=cancelled를 직접 요청하면 취소 이력을 보여 줌
   */
  async listMissions(userId, filters) {
    const {
      date,
      from,
      to,
      goalId,
      stepId,
      status,
      statuses,
      categoryId,
      cursor,
      limit,
    } = filters;
    const where = ['user_id = $1', 'deleted_at IS NULL'];
    const params = [userId];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (date) add('scheduled_date = ?::date', date);
    if (from) add('scheduled_date >= ?::date', from);
    if (to) add('scheduled_date <= ?::date', to);
    if (goalId) add('goal_id = ?::short_id', goalId);
    if (stepId) add('goal_step_id = ?::short_id', stepId);
    if (categoryId) add('category_id = ?::short_id', categoryId);
    if (statuses?.length) add('status = ANY(?::text[])', statuses);
    else if (status) add('status = ?::text', status);
    else where.push("status <> 'cancelled'");

    if (cursor) {
      let after;
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (![after.d, after.t, after.id].every((v) => typeof v === 'string'))
          throw new Error();
      } catch {
        throw badRequest('잘못된 cursor');
      }
      params.push(after.d, after.t, after.id);
      const n = params.length;
      where.push(
        `(scheduled_date, created_at, id) > ($${n - 2}::date, $${n - 1}::timestamptz, $${n}::short_id)`,
      );
    }

    params.push(limit + 1);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, created_at::text AS created_at_raw
         FROM missions
        WHERE ${where.join(' AND ')}
        ORDER BY scheduled_date, created_at, id
        LIMIT $${params.length}`,
      params,
    );

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.toView(row)),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({
                d: last.scheduled_date,
                t: last.created_at_raw,
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }

  /**
   * 수정: 시작 전(scheduled)에는 제목·설명·목표량·인증 방식·예정일·마감·필수 여부·단계 연결·메모,
   * 시작 후에는 메모만. 카테고리·난이도는 보상표 버전과 짝이라 바꿀 수 없음(취소 후 새로 생성)
   * 메모만 바꾸는 요청은 이용 제한 중에도 허용, 그 외 수정은 새 활동으로 보고 검사
   */
  async updateMission(userId, missionId, patch) {
    const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
    if (keys.length === 0) throw badRequest('변경할 값이 없음');
    const memoOnly = keys.every((key) => key === 'memo');
    if (!memoOnly) await this.activeGuard.assertActive(userId);

    return this.database.withTransaction(async (tx) => {
      const mission = await this.loadMission(tx, userId, missionId, {
        lock: true,
      });
      this.assertNotChallenge(mission);
      if (mission.status !== 'scheduled' && !memoOnly) {
        throw conflict(
          'mission_started',
          '수행이 시작된 미션은 메모만 수정할 수 있음',
          {
            status: mission.status,
            fields: keys.filter((key) => key !== 'memo'),
          },
        );
      }

      const values = { ...patch };
      let goal = null;
      if (!memoOnly) {
        if (mission.goal_id) {
          goal = await this.goals.loadGoal(tx, userId, mission.goal_id, {
            lock: true,
          });
        }

        const targetValue = patch.targetValue ?? mission.target_value;
        const targetUnit = patch.targetUnit ?? mission.target_unit;
        if ((targetValue === null) !== (targetUnit === null)) {
          throw badRequest('targetValue와 targetUnit은 함께 지정해야 함');
        }

        // 보상은 만들 때 고정되므로, 수치를 바꿔 난이도가 달라지면 수정 대신 새로 만들게 한다
        const contentChanged = [
          'targetValue',
          'targetUnit',
          'estimatedDurationSeconds',
        ].some((key) => patch[key] !== undefined);
        if (contentChanged && mission.source_type !== 'template') {
          const next = assessDifficulty({
            exerciseCode: mission.exercise_code,
            targetValue,
            targetUnit,
            estimatedDurationSeconds:
              patch.estimatedDurationSeconds ??
              mission.estimated_duration_seconds,
          }).difficultyCode;
          const { rows: current } = await tx.query(
            'SELECT code FROM difficulty_levels WHERE id = $1',
            [mission.difficulty_id],
          );
          if (current[0]?.code !== next) {
            throw conflict(
              'difficulty_changed',
              `이렇게 바꾸면 난이도가 '${difficultyName(next)}'(으)로 바뀌어요. 보상은 만들 때 정해져서, 이 미션을 취소하고 새로 만들어 주세요`,
              { from: current[0]?.code ?? null, to: next },
            );
          }
        }

        const date = patch.scheduledDate ?? mission.scheduled_date;
        if (
          patch.scheduledDate !== undefined &&
          patch.scheduledDate !== mission.scheduled_date
        ) {
          this.assertDates([date], goal);
          await this.assertDailyCapacity(tx, userId, [date], {
            excludeMissionId: missionId,
          });
          // 마감 시각을 따로 지정하지 않으면 새 예정일의 기본 마감으로 옮김
          if (patch.dueAt === undefined) values.dueAt = defaultDueAt(date);
        }
        if (patch.dueAt !== undefined) this.assertDueAt(patch.dueAt, date);

        if (patch.stepId !== undefined && patch.stepId !== null) {
          if (!mission.goal_id)
            throw badRequest(
              '목표에 연결되지 않은 미션에는 단계를 지정할 수 없음',
            );
          await this.loadStepOf(tx, mission.goal_id, patch.stepId);
        }
      }

      const fields = Object.keys(values).filter(
        (key) => values[key] !== undefined,
      );
      const assignments = fields.map(
        (key, index) => `${PATCH_COLUMNS[key]} = $${index + 3}`,
      );
      const params = fields.map((key) =>
        (key === 'description' || key === 'memo') && values[key] === ''
          ? null
          : values[key],
      );
      const { rows } = await tx.query(
        `UPDATE missions SET ${assignments.join(', ')}, updated_at = now()
          WHERE id = $1 AND user_id = $2
          RETURNING ${COLUMNS}`,
        [missionId, userId, ...params],
      );

      // 단계 연결이나 필수 여부가 바뀌면 이전·새 단계의 자동 완료 조건이 달라짐
      if (patch.stepId !== undefined || patch.isRequired !== undefined) {
        const affected = new Set(
          [mission.goal_step_id, rows[0].goal_step_id].filter(Boolean),
        );
        for (const stepId of affected)
          await this.goals.reevaluateStep(tx, stepId);
      }
      return this.toView(rows[0]);
    });
  }

  /** 시작 전 취소: 이력으로 남고 기본 목록에서는 숨김 */
  async cancelMission(userId, missionId) {
    return this.database.withTransaction(async (tx) => {
      const mission = await this.loadMission(tx, userId, missionId, {
        lock: true,
      });
      this.assertNotChallenge(mission);
      if (mission.status !== 'scheduled') {
        throw conflict(
          'mission_started',
          '수행이 시작된 미션은 취소할 수 없음',
          {
            status: mission.status,
          },
        );
      }
      const { rows } = await tx.query(
        `UPDATE missions
            SET status = 'cancelled', cancel_reason = 'user_cancelled',
                cancelled_at = now(), updated_at = now()
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [missionId],
      );
      if (mission.goal_step_id)
        await this.goals.reevaluateStep(tx, mission.goal_step_id);
      return this.toView(rows[0]);
    });
  }

  /**
   * 소프트 삭제: 수행 중·판정 대기 미션은 삭제할 수 없음
   * 시작 전 미션은 계획에서 빠지도록 취소(user_deleted)를 함께 기록, 끝난 미션은 보상·스트릭·인증 근거를 유지
   */
  async deleteMission(userId, missionId) {
    await this.database.withTransaction(async (tx) => {
      const mission = await this.loadMission(tx, userId, missionId, {
        lock: true,
      });
      this.assertNotChallenge(mission);
      if (mission.status === 'in_progress' || mission.status === 'submitted') {
        throw conflict(
          'mission_in_progress',
          '수행 중이거나 판정 대기 중인 미션은 삭제할 수 없음',
          {
            status: mission.status,
          },
        );
      }
      await tx.query(
        `UPDATE missions
            SET deleted_at = now(), updated_at = now(),
                status = CASE WHEN status = 'scheduled' THEN 'cancelled' ELSE status END,
                cancel_reason = CASE WHEN status = 'scheduled' THEN 'user_deleted' ELSE cancel_reason END,
                cancelled_at = CASE WHEN status = 'scheduled' THEN now() ELSE cancelled_at END
          WHERE id = $1`,
        [missionId],
      );
      if (mission.goal_step_id)
        await this.goals.reevaluateStep(tx, mission.goal_step_id);
    });
  }

  /**
   * 마감 처리 작업: 마감이 지났고 판정을 기다리는 제출이 없는 scheduled/in_progress 미션을 failed로
   * (due_at이 없으면 예정일 다음 날 0시 KST). 판정 대기 제출이 있으면 판정 결과가 상태 결정
   * 미션별 트랜잭션에서 잠금 후 조건 재확인 → 동시 제출·판정과 겹쳐도 안전
   */
  async failOverdue({ limit = 200 } = {}) {
    const overdue = `
      m.status IN ('scheduled', 'in_progress')
      AND COALESCE(m.due_at, ((m.scheduled_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')) < now()
      AND NOT EXISTS (SELECT 1 FROM mission_records r
                       WHERE r.mission_id = m.id AND r.status IN ('submitted', 'review_required'))`;
    const { rows } = await this.database.query(
      `SELECT m.id FROM missions m WHERE ${overdue} ORDER BY m.scheduled_date, m.id LIMIT $1`,
      [limit],
    );
    let failed = 0;
    for (const { id } of rows) {
      const done = await this.database.withTransaction(async (tx) => {
        await tx.query('SELECT 1 FROM missions WHERE id = $1 FOR UPDATE', [id]);
        const { rowCount } = await tx.query(
          `UPDATE missions m SET status = 'failed', updated_at = now()
            WHERE m.id = $1 AND ${overdue}`,
          [id],
        );
        return rowCount > 0;
      });
      if (done) failed += 1;
    }
    return { failed };
  }

  /** 챌린지 미션이면 challengeId를 채움 (08 Mission.challengeId) */
  async attachChallengeIds(views) {
    const list = Array.isArray(views) ? views : [views];
    if (list.length === 0) return views;
    const { rows } = await this.database.query(
      `SELECT mission_id, challenge_id
         FROM challenge_daily_missions WHERE mission_id = ANY($1::short_id[])`,
      [list.map((view) => view.id)],
    );
    const byMission = new Map(rows.map((r) => [r.mission_id, r.challenge_id]));
    for (const view of list) view.challengeId = byMission.get(view.id) ?? null;
    return views;
  }

  /** A32 MissionDetail: 미션 + 최근 수행 기록·제출 횟수·가능한 동작 */
  async getDetail(userId, missionId) {
    const view = await this.getMission(userId, missionId);
    return this.toDetail(view);
  }

  async toDetail(view) {
    await this.attachChallengeIds(view);
    const { rows } = await this.database.query(
      `SELECT id, attempt_no, status, started_at,
              (SELECT d.decision FROM verification_results d
                WHERE d.record_id = r.id
                ORDER BY d.result_no DESC LIMIT 1) AS decision,
              (SELECT count(*)::int FROM mission_records s
                WHERE s.mission_id = r.mission_id AND s.submission_no IS NOT NULL) AS submissions
         FROM mission_records r
        WHERE r.mission_id = $1
        ORDER BY r.attempt_no DESC
        LIMIT 1`,
      [view.id],
    );
    const latest = rows[0];
    const submissionCount = latest?.submissions ?? 0;
    return {
      ...view,
      latestRecord: latest
        ? {
            id: latest.id,
            attemptNo: latest.attempt_no,
            status: latest.status,
            decision: latest.decision ?? null,
            startedAt: latest.started_at,
          }
        : null,
      submissionCount,
      remainingSubmissions: Math.max(0, MAX_SUBMISSIONS - submissionCount),
      canStart: view.status === 'scheduled' || view.status === 'in_progress',
      canEdit: view.status === 'scheduled' && view.challengeId === null,
      guide: GUIDES[view.exerciseCode] ?? null,
    };
  }
}
