import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AchievementsService } from '../achievements/achievements.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { MAX_ACTIVE_GOALS, MAX_GOAL_PERIOD_DAYS } from './goals.constants.js';
import { conflict, unprocessable } from '../common/errors/http-errors.js';

const num = (value) => Number(value);
const DAY_MS = 24 * 60 * 60 * 1000;

const goalNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'goal_not_found',
    '목표를 찾을 수 없음',
  );

/** 목표 API가 허용하는 상태 전이: 동작 → [허용하는 현재 상태, 새 상태] */
const TRANSITIONS = {
  pause: [['active'], 'paused'],
  resume: [['paused'], 'active'],
  complete: [['active', 'paused'], 'completed'],
  reopen: [['completed'], 'active'],
};

// PATCH로 바꿀 수 있는 컬럼(쿼리에 들어가므로 고정 목록만 사용)
const PATCH_COLUMNS = {
  title: 'title',
  description: 'description',
  categoryId: 'category_id',
  difficultyId: 'difficulty_id',
  startDate: 'start_date',
  endDate: 'end_date',
  targetFrequency: 'target_frequency',
  dailyAvailableMinutes: 'daily_available_minutes',
};

function periodDays(startDate, endDate) {
  return (
    (Date.parse(`${endDate}T00:00:00Z`) -
      Date.parse(`${startDate}T00:00:00Z`)) /
      DAY_MS +
    1
  );
}

function rate(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 10_000) / 10_000;
}

/**
 * 목표·진행률
 * 진행 지표는 저장하지 않고 조회 시 계산(정책 03). 삭제된 목표는 모든 조회에서 제외
 */
@Injectable()
@Dependencies(DatabaseService, AchievementsService)
export class GoalsService {
  constructor(database, achievements) {
    this.database = database;
    this.achievements = achievements;
  }

  /** 카테고리·난이도가 존재하고 활성인지 */
  async assertReferences(db, categoryId, difficultyId) {
    const { rows } = await db.query(
      `SELECT (SELECT is_active FROM goal_categories WHERE id = $1) AS category,
              (SELECT is_active FROM difficulty_levels WHERE id = $2) AS difficulty`,
      [categoryId, difficultyId],
    );
    const invalid = [];
    if (rows[0].category !== true) invalid.push('categoryId');
    if (rows[0].difficulty !== true) invalid.push('difficultyId');
    if (invalid.length > 0) {
      throw unprocessable(
        'inactive_reference',
        '사용할 수 없는 카테고리 또는 난이도',
        {
          fields: invalid,
        },
      );
    }
  }

  assertPeriod(startDate, endDate) {
    if (endDate < startDate) {
      throw unprocessable('invalid_period', '종료일이 시작일보다 빠름');
    }
    if (periodDays(startDate, endDate) > MAX_GOAL_PERIOD_DAYS) {
      throw unprocessable(
        'invalid_period',
        `기간은 최대 ${MAX_GOAL_PERIOD_DAYS}일`,
      );
    }
  }

  /** 소유자 확인과 함께 목표 한 건 조회, lock이면 행 잠금(단계·미션 추가 직렬화용) */
  async loadGoal(db, userId, goalId, { lock = false } = {}) {
    const { rows } = await db.query(
      `SELECT id, title, description, category_id, difficulty_id, start_date, end_date,
              target_frequency, daily_available_minutes, status, completed_at, created_at, updated_at,
              EXISTS (SELECT 1 FROM ai_plan_proposals ap WHERE ap.goal_id = goals.id AND ap.status = 'accepted') AS has_accepted_plan
         FROM goals
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        ${lock ? 'FOR UPDATE' : ''}`,
      [goalId, userId],
    );
    if (!rows[0]) throw goalNotFound();
    return rows[0];
  }

  toView(row, progress) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      categoryId: row.category_id,
      difficultyId: row.difficulty_id,
      startDate: row.start_date,
      endDate: row.end_date,
      targetFrequency: row.target_frequency,
      dailyAvailableMinutes: row.daily_available_minutes ?? null,
      status: row.status,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      progress,
      // 모바일 클라이언트(08 Goal) 키
      progressRate: progress?.missions?.rate ?? 0,
      hasAcceptedPlan: Boolean(row.has_accepted_plan),
    };
  }

  /** 목표 id들의 미션·단계 진행률을 두 번의 집계 쿼리로 계산 */
  async progressFor(db, goalIds) {
    const result = new Map(
      goalIds.map((id) => [
        id,
        {
          missions: { total: 0, completed: 0, rate: 0 },
          steps: { total: 0, completed: 0, rate: 0 },
        },
      ]),
    );
    if (goalIds.length === 0) return result;

    const [missions, steps] = await Promise.all([
      db.query(
        `SELECT goal_id, count(*) AS total,
                count(*) FILTER (WHERE status = 'completed') AS done
           FROM missions
          WHERE goal_id = ANY($1::uuid[]) AND deleted_at IS NULL AND status <> 'cancelled'
          GROUP BY goal_id`,
        [goalIds],
      ),
      db.query(
        `SELECT goal_id, count(*) AS total,
                count(*) FILTER (WHERE status = 'completed') AS done
           FROM goal_steps WHERE goal_id = ANY($1::uuid[]) GROUP BY goal_id`,
        [goalIds],
      ),
    ]);
    for (const row of missions.rows) {
      const total = num(row.total);
      const completed = num(row.done);
      result.get(row.goal_id).missions = {
        total,
        completed,
        rate: rate(completed, total),
      };
    }
    for (const row of steps.rows) {
      const total = num(row.total);
      const completed = num(row.done);
      result.get(row.goal_id).steps = {
        total,
        completed,
        rate: rate(completed, total),
      };
    }
    return result;
  }

  async createGoal(userId, input) {
    const data = { ...input };
    if (!data.difficultyId) {
      const { rows } = await this.database.query(
        "SELECT id FROM difficulty_levels WHERE code = 'normal'",
      );
      data.difficultyId = rows[0]?.id;
    }
    this.assertPeriod(data.startDate, data.endDate);
    await this.assertReferences(
      this.database,
      data.categoryId,
      data.difficultyId,
    );

    return this.database.withTransaction(async (tx) => {
      // 같은 사용자의 동시 생성이 상한 검사를 함께 통과하지 못하게 직렬화
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const { rows: count } = await tx.query(
        `SELECT count(*) AS n FROM goals
          WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('active', 'paused')`,
        [userId],
      );
      if (num(count[0].n) >= MAX_ACTIVE_GOALS) {
        throw conflict(
          'goal_limit_reached',
          `진행 중인 목표는 최대 ${MAX_ACTIVE_GOALS}개`,
        );
      }

      const { rows } = await tx.query(
        `INSERT INTO goals
                (id, user_id, category_id, difficulty_id, title, description,
                 start_date, end_date, target_frequency, daily_available_minutes)
         VALUES ($9, $1, $2, $3, $4, $5, $6, $7, $8, $10)
         RETURNING id, title, description, category_id, difficulty_id, start_date,
                   end_date, target_frequency, daily_available_minutes, status, completed_at, created_at, updated_at,
              EXISTS (SELECT 1 FROM ai_plan_proposals ap WHERE ap.goal_id = goals.id AND ap.status = 'accepted') AS has_accepted_plan`,
        [
          userId,
          data.categoryId,
          data.difficultyId,
          data.title,
          data.description || null,
          data.startDate,
          data.endDate,
          data.targetFrequency ?? null,
          randomUUID(),
          data.dailyAvailableMinutes ?? null,
        ],
      );
      return this.toView(
        rows[0],
        (await this.progressFor(tx, [rows[0].id])).get(rows[0].id),
      );
    });
  }

  /** 내 목표 목록, 최신순 커서(마이크로초 정밀도를 위해 created_at을 텍스트로 주고받음) */
  async listGoals(
    userId,
    { status, statuses, categoryId, cursor, limit = 20 },
  ) {
    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.t !== 'string' || typeof after.id !== 'string')
          throw new Error();
      } catch {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'bad_request',
          '잘못된 cursor',
        );
      }
    }

    const { rows } = await this.database.query(
      `SELECT id, title, description, category_id, difficulty_id, start_date, end_date,
              target_frequency, daily_available_minutes, status, completed_at, created_at, updated_at,
              EXISTS (SELECT 1 FROM ai_plan_proposals ap WHERE ap.goal_id = goals.id AND ap.status = 'accepted') AS has_accepted_plan,
              created_at::text AS created_at_raw
         FROM goals
        WHERE user_id = $1 AND deleted_at IS NULL
          AND ($2::text IS NULL OR status = $2)
          AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))
          AND ($6::text[] IS NULL OR status = ANY($6::text[]))
          AND ($7::uuid IS NULL OR category_id = $7)
        ORDER BY created_at DESC, id DESC
        LIMIT $5`,
      [
        userId,
        status ?? null,
        after?.t ?? null,
        after?.id ?? null,
        limit + 1,
        statuses ?? null,
        categoryId ?? null,
      ],
    );

    const page = rows.slice(0, limit);
    const progress = await this.progressFor(
      this.database,
      page.map((row) => row.id),
    );
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.toView(row, progress.get(row.id))),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({ t: last.created_at_raw, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  /** 목표 상세: 단계 목록과 단계별 필수 미션 진행 포함 */
  async getGoal(userId, goalId) {
    const goal = await this.loadGoal(this.database, userId, goalId);
    const [progress, steps, stepMissions, todayMissions] = await Promise.all([
      this.progressFor(this.database, [goalId]),
      this.database.query(
        `SELECT id, step_no, title, description, due_date, status, completed_at
           FROM goal_steps WHERE goal_id = $1 ORDER BY step_no`,
        [goalId],
      ),
      this.database.query(
        `SELECT goal_step_id, count(*) AS total,
                count(*) FILTER (WHERE status = 'completed') AS done
           FROM missions
          WHERE goal_id = $1 AND goal_step_id IS NOT NULL AND is_required
            AND deleted_at IS NULL AND status <> 'cancelled'
          GROUP BY goal_step_id`,
        [goalId],
      ),
      this.database.query(
        `SELECT id FROM missions
          WHERE goal_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
            AND scheduled_date = (now() AT TIME ZONE 'Asia/Seoul')::date
          ORDER BY created_at, id`,
        [goalId],
      ),
    ]);
    // 모바일 GoalStep.isCurrent: 끝나지 않은 단계 중 번호가 가장 작은 것
    const currentStepId = steps.rows.find((s) => s.status !== 'completed')?.id;
    const summary = progress.get(goalId);
    const byStep = new Map(stepMissions.rows.map((r) => [r.goal_step_id, r]));
    return {
      ...this.toView(goal, progress.get(goalId)),
      steps: steps.rows.map((s) => ({
        id: s.id,
        stepNo: s.step_no,
        title: s.title,
        description: s.description,
        dueDate: s.due_date,
        status: s.status,
        completedAt: s.completed_at,
        requiredMissions: {
          total: num(byStep.get(s.id)?.total ?? 0),
          completed: num(byStep.get(s.id)?.done ?? 0),
        },
        missionCount: num(byStep.get(s.id)?.total ?? 0),
        completedMissionCount: num(byStep.get(s.id)?.done ?? 0),
        isCurrent: s.id === currentStepId,
      })),
      totalMissionCount: summary?.missions.total ?? 0,
      completedMissionCount: summary?.missions.completed ?? 0,
      todayMissionIds: todayMissions.rows.map((r) => r.id),
    };
  }

  /**
   * 목표 수정, 기간을 줄일 때는 기간 밖에 남는 미션·단계가 없어야 함
   * 카테고리·난이도는 바꿀 수 있고 이미 만든 미션에는 영향이 없음(값을 복사해 가짐)
   */
  async updateGoal(userId, goalId, patch) {
    const fields = Object.keys(patch).filter((key) => patch[key] !== undefined);
    if (fields.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'bad_request',
        '변경할 값이 없음',
      );
    }

    return this.database.withTransaction(async (tx) => {
      const goal = await this.loadGoal(tx, userId, goalId, { lock: true });

      const startDate = patch.startDate ?? goal.start_date;
      const endDate = patch.endDate ?? goal.end_date;
      if (patch.startDate !== undefined || patch.endDate !== undefined) {
        this.assertPeriod(startDate, endDate);
        const outside = await tx.query(
          `SELECT
             EXISTS (SELECT 1 FROM missions
                      WHERE goal_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
                        AND (scheduled_date < $2 OR scheduled_date > $3)) AS missions,
             EXISTS (SELECT 1 FROM goal_steps
                      WHERE goal_id = $1 AND (due_date < $2 OR due_date > $3)) AS steps`,
          [goalId, startDate, endDate],
        );
        if (outside.rows[0].missions) {
          throw conflict(
            'missions_outside_period',
            '기간 밖에 연결된 미션이 있음',
          );
        }
        if (outside.rows[0].steps) {
          throw conflict(
            'steps_outside_period',
            '기간 밖에 마감일이 있는 단계가 있음',
          );
        }
      }
      if (patch.categoryId !== undefined || patch.difficultyId !== undefined) {
        await this.assertReferences(
          tx,
          patch.categoryId ?? goal.category_id,
          patch.difficultyId ?? goal.difficulty_id,
        );
      }

      const assignments = fields.map(
        (key, index) => `${PATCH_COLUMNS[key]} = $${index + 3}`,
      );
      const values = fields.map((key) =>
        key === 'description' ? patch[key] || null : patch[key],
      );
      const { rows } = await tx.query(
        `UPDATE goals SET ${assignments.join(', ')}, updated_at = now()
          WHERE id = $1 AND user_id = $2
          RETURNING id, title, description, category_id, difficulty_id, start_date,
                    end_date, target_frequency, daily_available_minutes, status, completed_at, created_at, updated_at,
              EXISTS (SELECT 1 FROM ai_plan_proposals ap WHERE ap.goal_id = goals.id AND ap.status = 'accepted') AS has_accepted_plan`,
        [goalId, userId, ...values],
      );
      return this.toView(
        rows[0],
        (await this.progressFor(tx, [goalId])).get(goalId),
      );
    });
  }

  /**
   * 상태 전이: pause, resume, complete, reopen
   * 완료는 사용자가 직접 확정(진행률로 자동 완료하지 않음), 완료 취소는 completed_at을 비움
   * 완료 확정과 같은 트랜잭션에서 업적(첫 목표 완료)을 평가
   */
  async transition(userId, goalId, action) {
    const [from, to] = TRANSITIONS[action];
    return this.database.withTransaction(async (tx) => {
      const goal = await this.loadGoal(tx, userId, goalId, { lock: true });
      if (!from.includes(goal.status)) {
        throw conflict('invalid_transition', '현재 상태에서 할 수 없는 동작', {
          status: goal.status,
          action,
        });
      }

      await tx.query(
        `UPDATE goals
            SET status = $2::text,
                completed_at = CASE WHEN $2::text = 'completed' THEN now() END,
                updated_at = now()
          WHERE id = $1`,
        [goalId, to],
      );

      let achievements = [];
      if (to === 'completed') {
        achievements =
          (await this.achievements.evaluate(tx, {
            userId,
            trigger: 'goal_completed',
          })) ?? [];
      }

      const updated = await this.loadGoal(tx, userId, goalId);
      return {
        ...this.toView(
          updated,
          (await this.progressFor(tx, [goalId])).get(goalId),
        ),
        achievements: Array.isArray(achievements) ? achievements : [],
      };
    });
  }

  /** 소프트 삭제, DB 트리거가 시작 전 미션을 취소(goal_deleted)로 바꿈 */
  async removeGoal(userId, goalId) {
    const { rowCount } = await this.database.query(
      `UPDATE goals SET deleted_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [goalId, userId],
    );
    if (rowCount === 0) throw goalNotFound();
  }

  /**
   * 단계 자동 완료/재개방 재평가
   * 종료일(KST)이 지났고 취소·삭제되지 않은 필수 미션이 1개 이상이며 모두 완료면 완료,
   * 조건이 깨지면(미션 추가 등) 다시 연다. 호출 시점: 미션 완료·취소·삭제·추가, 매일 작업
   */
  async reevaluateStep(tx, stepId) {
    const { rows } = await tx.query(
      `SELECT status, due_date < (now() AT TIME ZONE 'Asia/Seoul')::date AS past
         FROM goal_steps WHERE id = $1 FOR UPDATE`,
      [stepId],
    );
    const step = rows[0];
    if (!step) return 'missing';

    const { rows: counts } = await tx.query(
      `SELECT count(*) AS total, count(*) FILTER (WHERE status = 'completed') AS done
         FROM missions
        WHERE goal_step_id = $1 AND is_required AND deleted_at IS NULL AND status <> 'cancelled'`,
      [stepId],
    );
    const total = num(counts[0].total);
    const shouldBeCompleted =
      step.past && total > 0 && num(counts[0].done) === total;

    if (shouldBeCompleted && step.status === 'active') {
      await tx.query(
        `UPDATE goal_steps SET status = 'completed', completed_at = now(), updated_at = now()
          WHERE id = $1`,
        [stepId],
      );
      return 'completed';
    }
    if (!shouldBeCompleted && step.status === 'completed') {
      await tx.query(
        `UPDATE goal_steps SET status = 'active', completed_at = NULL, updated_at = now()
          WHERE id = $1`,
        [stepId],
      );
      return 'reopened';
    }
    return 'unchanged';
  }

  /** 종료일이 막 지난 단계를 모아 재평가, JobsModule의 매일 작업이 호출 */
  async sweepDueSteps({ limit = 500 } = {}) {
    const { rows } = await this.database.query(
      `SELECT gs.id
         FROM goal_steps gs
         JOIN goals g ON g.id = gs.goal_id
        WHERE gs.status = 'active' AND g.deleted_at IS NULL
          AND gs.due_date < (now() AT TIME ZONE 'Asia/Seoul')::date
        ORDER BY gs.due_date, gs.id
        LIMIT $1`,
      [limit],
    );
    let completed = 0;
    for (const row of rows) {
      const outcome = await this.database.withTransaction((tx) =>
        this.reevaluateStep(tx, row.id),
      );
      if (outcome === 'completed') completed += 1;
    }
    return { checked: rows.length, completed };
  }
}
