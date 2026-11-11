import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { MAX_STEPS_PER_GOAL } from './goals.constants.js';
import { GoalsService } from './goals.service.js';
import { conflict } from '../common/errors/http-errors.js';

const num = (value) => Number(value);

const stepNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'step_not_found',
    '단계를 찾을 수 없음',
  );

/**
 * 목표 단계
 * 단계 번호는 목표 행을 잠근 뒤 마지막 번호 + 1로 부여해 동시 생성에서도 겹치지 않게 함
 */
@Injectable()
@Dependencies(DatabaseService, GoalsService)
export class StepsService {
  constructor(database, goals) {
    this.database = database;
    this.goals = goals;
  }

  toView(row) {
    return {
      id: row.id,
      goalId: row.goal_id,
      stepNo: row.step_no,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      status: row.status,
      completedAt: row.completed_at,
    };
  }

  assertDueDate(goal, dueDate) {
    if (dueDate < goal.start_date || dueDate > goal.end_date) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'step_due_out_of_period',
        '단계 마감일이 목표 기간 밖',
      );
    }
  }

  async createStep(userId, goalId, data) {
    return this.database.withTransaction(async (tx) => {
      const goal = await this.goals.loadGoal(tx, userId, goalId, {
        lock: true,
      });
      if (goal.status === 'completed') {
        throw conflict(
          'goal_completed',
          '완료된 목표에는 단계를 추가할 수 없음',
        );
      }
      this.assertDueDate(goal, data.dueDate);

      const { rows: info } = await tx.query(
        `SELECT count(*) AS n, coalesce(max(step_no), 0) AS last FROM goal_steps WHERE goal_id = $1`,
        [goalId],
      );
      if (num(info[0].n) >= MAX_STEPS_PER_GOAL) {
        throw conflict(
          'step_limit_reached',
          `단계는 목표당 최대 ${MAX_STEPS_PER_GOAL}개`,
        );
      }

      const { rows } = await tx.query(
        `INSERT INTO goal_steps (id, goal_id, step_no, title, description, due_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, goal_id, step_no, title, description, due_date, status, completed_at`,
        [
          randomUUID(),
          goalId,
          num(info[0].last) + 1,
          data.title,
          data.description || null,
          data.dueDate,
        ],
      );
      return this.toView(rows[0]);
    });
  }

  async loadStep(db, goalId, stepId, { lock = false } = {}) {
    const { rows } = await db.query(
      `SELECT id, goal_id, step_no, title, description, due_date, status, completed_at
         FROM goal_steps WHERE id = $1 AND goal_id = $2 ${lock ? 'FOR UPDATE' : ''}`,
      [stepId, goalId],
    );
    if (!rows[0]) throw stepNotFound();
    return rows[0];
  }

  async updateStep(userId, goalId, stepId, patch) {
    const fields = Object.keys(patch).filter((key) => patch[key] !== undefined);
    if (fields.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'bad_request',
        '변경할 값이 없음',
      );
    }

    return this.database.withTransaction(async (tx) => {
      const goal = await this.goals.loadGoal(tx, userId, goalId, {
        lock: true,
      });
      await this.loadStep(tx, goalId, stepId, { lock: true });
      if (patch.dueDate !== undefined) this.assertDueDate(goal, patch.dueDate);

      const columns = {
        title: 'title',
        description: 'description',
        dueDate: 'due_date',
      };
      const assignments = fields.map(
        (key, index) => `${columns[key]} = $${index + 3}`,
      );
      const values = fields.map((key) =>
        key === 'description' ? patch[key] || null : patch[key],
      );
      await tx.query(
        `UPDATE goal_steps SET ${assignments.join(', ')}, updated_at = now()
          WHERE id = $1 AND goal_id = $2`,
        [stepId, goalId, ...values],
      );
      // 마감일이 바뀌면 자동 완료 조건이 달라질 수 있음
      await this.goals.reevaluateStep(tx, stepId);
      return this.toView(await this.loadStep(tx, goalId, stepId));
    });
  }

  /**
   * 단계 삭제: goal_steps를 지우면 FK(ON DELETE CASCADE)로 연결된 미션 행이 물리 삭제되므로,
   * 시작했거나 끝난 미션(취소 이력 포함)이 하나라도 있으면 거절하고,
   * 시작 전 미션만 있으면 단계 연결만 해제(목표에는 유지) 후 삭제
   */
  async removeStep(userId, goalId, stepId) {
    await this.database.withTransaction(async (tx) => {
      await this.goals.loadGoal(tx, userId, goalId, { lock: true });
      await this.loadStep(tx, goalId, stepId, { lock: true });

      const { rows } = await tx.query(
        `SELECT count(*) AS n FROM missions WHERE goal_step_id = $1 AND status <> 'scheduled'`,
        [stepId],
      );
      if (num(rows[0].n) > 0) {
        throw conflict(
          'step_has_history',
          '수행했거나 취소 이력이 있는 미션이 연결된 단계',
        );
      }

      await tx.query(
        `UPDATE missions SET goal_step_id = NULL, updated_at = now() WHERE goal_step_id = $1`,
        [stepId],
      );
      await tx.query('DELETE FROM goal_steps WHERE id = $1 AND goal_id = $2', [
        stepId,
        goalId,
      ]);
    });
  }
}
