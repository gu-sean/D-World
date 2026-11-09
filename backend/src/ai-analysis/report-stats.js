import { rateOf } from './periods.js';

// jsonb 숫자만 더하고 문자열 등은 무시 (AI가 준 metrics 값이 어떤 모양이어도 집계가 깨지지 않게)
const NUM = (key) =>
  `CASE WHEN jsonb_typeof(vr.metrics->'${key}') = 'number' THEN (vr.metrics->>'${key}')::numeric END`;

/**
 * 리포트 입력 통계 (AI 계약 ReportStats, ai/app/schemas/contracts.py)
 * 기간은 미션 예정일 기준, 취소·삭제된 미션은 제외
 */
export async function loadReportStats(db, userId, period, previous) {
  const params = [userId, period.start, period.end];
  const [totals, categories, exercises, flags, goals, streak, before] =
    await Promise.all([
      db.query(
        `SELECT count(*)::int AS planned,
                count(*) FILTER (WHERE status = 'completed')::int AS done,
                count(*) FILTER (WHERE status = 'failed')::int AS failed
           FROM missions
          WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
            AND scheduled_date BETWEEN $2::date AND $3::date`,
        params,
      ),
      db.query(
        `SELECT c.code, count(*)::int AS planned,
                count(*) FILTER (WHERE m.status = 'completed')::int AS done
           FROM missions m JOIN goal_categories c ON c.id = m.category_id
          WHERE m.user_id = $1 AND m.deleted_at IS NULL AND m.status <> 'cancelled'
            AND m.scheduled_date BETWEEN $2::date AND $3::date
          GROUP BY c.id ORDER BY c.display_order, c.id`,
        params,
      ),
      db.query(
        `SELECT m.exercise_code,
                count(*)::int AS done,
                coalesce(sum(${NUM('repCount')}), 0) AS reps,
                coalesce(sum(${NUM('holdSeconds')}), 0) AS hold,
                coalesce(sum(${NUM('distanceMeters')}), 0) AS meters
           FROM missions m
           JOIN mission_records r ON r.mission_id = m.id
           JOIN verification_results vr ON vr.record_id = r.id AND vr.is_current
          WHERE m.user_id = $1 AND m.deleted_at IS NULL AND m.status = 'completed'
            AND m.exercise_code IS NOT NULL AND vr.decision = 'approved'
            AND m.scheduled_date BETWEEN $2::date AND $3::date
          GROUP BY m.exercise_code ORDER BY m.exercise_code`,
        params,
      ),
      db.query(
        `SELECT flag AS code, count(*)::int AS n
           FROM missions m
           JOIN mission_records r ON r.mission_id = m.id
           JOIN verification_results vr ON vr.record_id = r.id AND vr.is_current
           CROSS JOIN LATERAL jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(vr.metrics->'flags') = 'array'
                  THEN vr.metrics->'flags' ELSE '[]'::jsonb END) AS flag
          WHERE m.user_id = $1 AND m.deleted_at IS NULL
            AND m.scheduled_date BETWEEN $2::date AND $3::date
          GROUP BY flag ORDER BY n DESC, flag LIMIT 5`,
        params,
      ),
      db.query(
        `SELECT g.title, c.code,
                count(m.id) FILTER (WHERE m.status <> 'cancelled')::int AS total,
                count(m.id) FILTER (WHERE m.status = 'completed')::int AS done
           FROM goals g
           JOIN goal_categories c ON c.id = g.category_id
           LEFT JOIN missions m ON m.goal_id = g.id AND m.deleted_at IS NULL
          WHERE g.user_id = $1 AND g.status = 'active' AND g.deleted_at IS NULL
          GROUP BY g.id, c.code ORDER BY g.created_at LIMIT 10`,
        [userId],
      ),
      db.query(
        'SELECT current_success_days FROM streak_states WHERE user_id = $1',
        [userId],
      ),
      db.query(
        `SELECT count(*)::int AS planned,
                count(*) FILTER (WHERE status = 'completed')::int AS done
           FROM missions
          WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
            AND scheduled_date BETWEEN $2::date AND $3::date`,
        [userId, previous.start, previous.end],
      ),
    ]);

  const { planned, done, failed } = totals.rows[0];
  return {
    plannedMissionCount: planned,
    completedMissionCount: done,
    failedMissionCount: failed,
    achievementRate: rateOf(done, planned) ?? 0,
    previousAchievementRate: rateOf(
      before.rows[0].done,
      before.rows[0].planned,
    ),
    streakDays: streak.rows[0]?.current_success_days ?? 0,
    categories: categories.rows.map((row) => ({
      categoryCode: row.code,
      completedValue: row.done,
      targetValue: row.planned,
      unit: 'times',
      rate: rateOf(row.done, row.planned) ?? 0,
    })),
    exercises: exercises.rows.map((row) => ({
      exerciseCode: row.exercise_code,
      completedCount: row.done,
      totalReps: Math.round(Number(row.reps)),
      totalHoldSeconds: Number(row.hold),
      totalMeters: Number(row.meters),
    })),
    topFailureFlags: flags.rows.map((row) => ({
      code: row.code,
      count: row.n,
    })),
    activeGoals: goals.rows.map((row) => ({
      title: row.title,
      categoryCode: row.code,
      progressRate: rateOf(row.done, row.total) ?? 0,
    })),
  };
}
