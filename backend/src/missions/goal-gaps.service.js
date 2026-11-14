import { Dependencies, Injectable } from '@nestjs/common';
import { addDays, kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { GoalsService } from '../goals/goals.service.js';
import { conflict } from '../common/errors/http-errors.js';
import { MissionsService } from './missions.service.js';

const DEFAULT_FREQUENCY = 3;
const DEFAULT_MINUTES = 30;
const DAY_MS = 86_400_000;

const dayDiff = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
// 월요일(0) ~ 일요일(6)
const weekday = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * 목표의 빈 주 찾기와 채우기
 *
 * 사용자가 세부 미션을 한 번에 다 쓰기 어려우므로, 오늘 이후 목표 기간을 주(월~일) 단위로 나눠
 * "주 N회"보다 미션이 적은 주를 알려 준다. 앱은 이 주들을 보고 "AI가 채워 줄까요? / 빈칸으로 두기"를 묻는다.
 * 빈 주에는 미션이 없으니 난이도도 보상도 없다. 채우면 그 미션마다 규칙으로 난이도·보상이 정해진다.
 * 채우기는 AI 서버 연동 전까지 규칙 기반 (목표 제목과 하루 가능 시간으로 미션을 만든다).
 */
@Injectable()
@Dependencies(DatabaseService, GoalsService, MissionsService)
export class GoalGapsService {
  constructor(database, goals, missions) {
    this.database = database;
    this.goals = goals;
    this.missions = missions;
  }

  /** 오늘 이후 목표 기간의 주별 목표 횟수·예정 미션 수, 모자란 주만 */
  async findGaps(db, goal) {
    const today = kstDate();
    const from = goal.start_date > today ? goal.start_date : today;
    if (goal.end_date < from) return [];

    const { rows } = await db.query(
      `SELECT scheduled_date::text AS date, count(*)::int AS n
         FROM missions
        WHERE goal_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
          AND scheduled_date BETWEEN $2 AND $3
        GROUP BY scheduled_date`,
      [goal.id, from, goal.end_date],
    );
    const perDay = new Map(rows.map((row) => [row.date, row.n]));
    const frequency = goal.target_frequency ?? DEFAULT_FREQUENCY;

    const weeks = [];
    let start = from;
    while (start <= goal.end_date) {
      const sunday = addDays(start, 6 - weekday(start));
      const end = sunday > goal.end_date ? goal.end_date : sunday;
      const days = dayDiff(start, end) + 1;
      const target = Math.min(
        days,
        Math.max(1, Math.round((frequency * days) / 7)),
      );
      let planned = 0;
      const emptyDates = [];
      for (let i = 0; i < days; i += 1) {
        const date = addDays(start, i);
        const n = perDay.get(date) ?? 0;
        planned += n;
        if (n === 0) emptyDates.push(date);
      }
      if (planned < target) {
        weeks.push({
          from: start,
          to: end,
          targetCount: target,
          plannedCount: planned,
          missingCount: target - planned,
          emptyDates,
        });
      }
      start = addDays(end, 1);
    }
    return weeks;
  }

  async listGaps(userId, goalId) {
    const goal = await this.goals.loadGoal(this.database, userId, goalId);
    const weeks = await this.findGaps(this.database, goal);
    return {
      goalId,
      targetFrequency: goal.target_frequency ?? DEFAULT_FREQUENCY,
      missingCount: weeks.reduce((sum, week) => sum + week.missingCount, 0),
      weeks: weeks.map(({ emptyDates: _unused, ...week }) => week),
    };
  }

  /**
   * 빈 주 채우기: weekStarts를 주면 그 주만, 없으면 모든 빈 주
   * 미션이 없는 날 가운데 고르게 골라 모자란 횟수만큼 만든다
   */
  async fillGaps(userId, goalId, { weekStarts } = {}) {
    const goal = await this.goals.loadGoal(this.database, userId, goalId);
    if (goal.status !== 'active') {
      throw conflict('goal_not_active', '진행 중인 목표만 채울 수 있어요');
    }
    let weeks = await this.findGaps(this.database, goal);
    if (weekStarts?.length) {
      const wanted = new Set(weekStarts);
      weeks = weeks.filter((week) => wanted.has(week.from));
    }

    const dates = [];
    for (const week of weeks) {
      const pool = week.emptyDates;
      const count = Math.min(week.missingCount, pool.length);
      for (let i = 0; i < count; i += 1) {
        dates.push(pool[Math.floor(((i + 0.5) * pool.length) / count)]);
      }
    }
    if (dates.length === 0) {
      return { createdCount: 0, items: [] };
    }

    const minutes = goal.daily_available_minutes ?? DEFAULT_MINUTES;
    const items = [];
    // 한 요청의 날짜 상한(31)에 맞춰 나눠 만든다
    for (let i = 0; i < dates.length; i += 31) {
      const created = await this.missions.createMissions(userId, {
        title: `${goal.title} 연습`,
        description: `${minutes}분 동안 목표를 향해 한 걸음 나아가요.`,
        goalId,
        estimatedDurationSeconds: minutes * 60,
        scheduledDates: dates.slice(i, i + 31),
      });
      items.push(...created);
    }
    return { createdCount: items.length, items };
  }
}
