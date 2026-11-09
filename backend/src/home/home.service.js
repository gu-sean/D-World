import { Dependencies, Injectable } from '@nestjs/common';
import { addDays } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';

const DEFAULT_MESSAGE = '오늘도 한 걸음!';

const MISSION_COLUMNS = `m.id, m.goal_id, m.goal_step_id, m.source_type, m.title,
  m.description, m.category_id, m.difficulty_id, m.exercise_code,
  m.verification_method, m.target_value, m.target_unit,
  m.estimated_duration_seconds, m.scheduled_date::text AS scheduled_date,
  m.is_required, m.status, m.memo,
  m.reward_points, m.reward_user_xp, m.reward_pet_xp,
  dm.challenge_id`;

/** 월요일 시작 주의 월~일 날짜 7개 (date는 YYYY-MM-DD) */
export function weekDates(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  const monday = addDays(date, weekday === 0 ? -6 : 1 - weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** 현재 KST 시(0~23) */
export function kstHour(at = new Date()) {
  return (at.getUTCHours() + 9) % 24;
}

/** 추천 문구 조건(recommendation_messages.condition_type)이 지금 맞는지 */
export function messageMatches(message, context) {
  const params = message.condition_params ?? {};
  switch (message.condition_type) {
    case 'always':
      return true;
    case 'no_mission_today':
      return context.totalCount === 0;
    case 'streak_at_risk':
      return (
        context.isToday &&
        context.streakDays > 0 &&
        context.completedCount === 0 &&
        context.lastSuccessDate !== context.date
      );
    case 'inactive_days':
      return (
        context.daysSinceLastCompleted !== null &&
        context.daysSinceLastCompleted >= Number(params.days)
      );
    case 'time_slot': {
      const start = Number(params.start_hour);
      const end = Number(params.end_hour);
      const hour = context.hour;
      return start < end
        ? hour >= start && hour < end
        : hour >= start || hour < end;
    }
    default:
      return false;
  }
}

/** A29 홈 화면 요약 (07 HomeSummary) */
@Injectable()
@Dependencies(DatabaseService, RecommendationsService)
export class HomeService {
  constructor(database, recommendations) {
    this.database = database;
    this.recommendations = recommendations;
  }

  toMission(row) {
    return {
      id: row.id,
      goalId: row.goal_id,
      goalStepId: row.goal_step_id,
      challengeId: row.challenge_id ?? null,
      sourceType: row.source_type,
      title: row.title,
      description: row.description,
      // 응답 인터셉터가 categoryId·difficultyId를 categoryCode·difficultyCode로 바꿈
      categoryId: row.category_id,
      difficultyId: row.difficulty_id,
      exerciseCode: row.exercise_code,
      verificationMethod: row.verification_method,
      targetValue: row.target_value === null ? null : Number(row.target_value),
      targetUnit: row.target_unit,
      estimatedDurationSeconds: row.estimated_duration_seconds,
      scheduledDate: row.scheduled_date,
      isRequired: row.is_required,
      status: row.status,
      memo: row.memo,
      rewardPreview: {
        points: row.reward_points,
        userXp: row.reward_user_xp,
        petXp: row.reward_pet_xp,
      },
    };
  }

  async getHome(userId, date, today) {
    const week = weekDates(date);
    const [missionRows, weekRows, streakRows, challengeRows, recommendations] =
      await Promise.all([
        this.database.query(
          `SELECT ${MISSION_COLUMNS}
             FROM missions m
             LEFT JOIN challenge_daily_missions dm ON dm.mission_id = m.id
            WHERE m.user_id = $1 AND m.deleted_at IS NULL
              AND m.status <> 'cancelled' AND m.scheduled_date = $2::date
            ORDER BY m.due_at NULLS LAST, m.created_at, m.id`,
          [userId, date],
        ),
        this.database.query(
          `SELECT scheduled_date::text AS d,
                  count(*)::int AS total,
                  count(*) FILTER (WHERE status = 'completed')::int AS done
             FROM missions
            WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
              AND scheduled_date BETWEEN $2::date AND $3::date
            GROUP BY scheduled_date`,
          [userId, week[0], week[6]],
        ),
        this.database.query(
          `SELECT current_success_days, last_success_date::text AS last_success_date
             FROM streak_states WHERE user_id = $1`,
          [userId],
        ),
        this.database.query(
          `SELECT c.id, c.title,
                  COALESCE(dm.status, 'pending') AS today_status
             FROM challenge_participations p
             JOIN challenges c ON c.id = p.challenge_id
             LEFT JOIN challenge_daily_missions dm
                    ON dm.participation_id = p.id AND dm.challenge_date = $2::date
            WHERE p.user_id = $1 AND p.status = 'enrolled'
              AND c.publication_status = 'public'
              AND $2::date BETWEEN c.start_date AND c.end_date
            ORDER BY p.joined_at, c.id
            LIMIT 1`,
          [userId, date],
        ),
        this.recommendations.active(userId),
      ]);

    const missions = missionRows.rows.map((row) => this.toMission(row));
    const completedCount = missions.filter(
      (m) => m.status === 'completed',
    ).length;
    const totalCount = missions.length;
    const streak = streakRows.rows[0];
    const byDate = new Map(weekRows.rows.map((r) => [r.d, r]));
    const challenge = challengeRows.rows[0];

    return {
      date,
      message: await this.pickMessage({
        userId,
        date,
        isToday: date === today,
        totalCount,
        completedCount,
        streakDays: streak?.current_success_days ?? 0,
        lastSuccessDate: streak?.last_success_date ?? null,
        categoryIds: new Set(missionRows.rows.map((r) => r.category_id)),
      }),
      week: week.map((d) => ({
        date: d,
        completedCount: byDate.get(d)?.done ?? 0,
        totalCount: byDate.get(d)?.total ?? 0,
        isToday: d === today,
      })),
      summary: {
        completedCount,
        totalCount,
        progressRate:
          totalCount === 0
            ? 0
            : Number((completedCount / totalCount).toFixed(4)),
        streakDays: streak?.current_success_days ?? 0,
      },
      missions,
      // 아직 살아 있는 상황 추천(A93) 중 가장 앞선 한 건
      recommendation: recommendations[0] ?? null,
      activeChallenge: challenge
        ? {
            id: challenge.id,
            title: challenge.title,
            todayStatus: challenge.today_status,
          }
        : null,
    };
  }

  /** 조건에 맞는 활성 문구 중 우선순위가 가장 높은 것, 없으면 기본 문구 */
  async pickMessage(context) {
    const [messages, last] = await Promise.all([
      this.database.query(
        `SELECT message, condition_type, condition_params, category_id
           FROM recommendation_messages
          WHERE is_active
            AND (starts_at IS NULL OR starts_at <= now())
            AND (ends_at IS NULL OR ends_at > now())
          ORDER BY priority DESC, id`,
      ),
      this.database.query(
        `SELECT ($2::date - max(scheduled_date))::int AS days
           FROM missions
          WHERE user_id = $1 AND deleted_at IS NULL AND status = 'completed'
            AND scheduled_date <= $2::date`,
        [context.userId, context.date],
      ),
    ]);
    const full = {
      ...context,
      hour: kstHour(),
      daysSinceLastCompleted: last.rows[0]?.days ?? null,
    };
    const found = messages.rows.find(
      (row) =>
        (row.category_id === null ||
          context.categoryIds.has(row.category_id)) &&
        messageMatches(row, full),
    );
    return found?.message ?? DEFAULT_MESSAGE;
  }
}
