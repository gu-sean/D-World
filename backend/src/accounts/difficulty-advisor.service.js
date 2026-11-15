import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { newId } from '../common/ids.js';
import { DatabaseService } from '../database/database.service.js';
import { AiClient } from '../integrations/ai/ai.client.js';

export const DIFFICULTY_ADVISOR_VERSION = 'difficulty-agents@1.1.0';
const ORDER = ['easy', 'normal', 'hard'];

const clampIndex = (index) => Math.max(0, Math.min(ORDER.length - 1, index));

/** 1단계: 가입 때 받은 나이·키·몸무게를 바탕으로 안전한 시작점을 정한다. */
export function assessFitnessProfile({ age, heightCm, weightKg }) {
  if (!age || !heightCm || !weightKg) {
    return {
      agent: 'profile_agent',
      baseline: 'easy',
      bmi: null,
      flags: ['profile_incomplete'],
      reason: '신체정보가 아직 완성되지 않아 안전하게 쉬움부터 권장해요.',
    };
  }

  const bmi = Number((weightKg / (heightCm / 100) ** 2).toFixed(1));
  const flags = [];
  if (age < 18) flags.push('minor');
  if (age >= 60) flags.push('older_adult');
  if (bmi < 18.5) flags.push('low_bmi');
  if (bmi >= 30) flags.push('high_bmi');
  const baseline = flags.length > 0 ? 'easy' : 'normal';
  return {
    agent: 'profile_agent',
    baseline,
    bmi,
    flags,
    reason:
      baseline === 'easy'
        ? '연령과 체격 정보를 함께 보아 무리 없는 쉬움부터 권장해요.'
        : '연령과 체격 정보 기준으로 보통 단계에서 시작해도 좋아요.',
  };
}

/** 2단계: 최근 수행률과 사용자가 고른 강도를 반영한다. */
export function adjustForPerformance(profile, performance = {}, request = {}) {
  const completed = Number(performance.completed ?? 0);
  const planned = Number(performance.planned ?? 0);
  const completionRate = planned > 0 ? completed / planned : null;
  let index = ORDER.indexOf(profile.baseline);
  const signals = [];

  if (planned >= 8 && completionRate >= 0.85) {
    index += 1;
    signals.push('consistent_success');
  } else if (planned >= 4 && completionRate < 0.5) {
    index -= 1;
    signals.push('recent_struggle');
  }

  if (request.requestedDifficultyCode) {
    const requested = ORDER.indexOf(request.requestedDifficultyCode);
    if (requested >= 0) {
      index += Math.sign(requested - index);
      signals.push('user_preference');
    }
  }
  if (request.targetFrequency >= 6 || request.dailyAvailableMinutes >= 90) {
    index = Math.min(index, 1);
    signals.push('high_volume');
  }

  return {
    agent: 'performance_agent',
    candidate: ORDER[clampIndex(index)],
    completed,
    planned,
    completionRate:
      completionRate === null ? null : Number(completionRate.toFixed(2)),
    signals,
  };
}

/** 3단계: 앞선 결정을 독립적으로 검토하고 위험한 상향을 막는다. */
export function reviewDifficulty(profile, performance) {
  let finalDifficulty = performance.candidate;
  const adjustments = [];
  if (finalDifficulty === 'hard' && profile.flags.length > 0) {
    finalDifficulty = 'normal';
    adjustments.push('hard_capped_for_profile_safety');
  }
  if (profile.flags.includes('profile_incomplete')) {
    finalDifficulty = 'easy';
    adjustments.push('incomplete_profile_fallback');
  }

  const label = { easy: '쉬움', normal: '보통', hard: '어려움' }[
    finalDifficulty
  ];
  const performanceReason = performance.signals.includes('consistent_success')
    ? '최근 미션을 꾸준히 완료한 기록을 반영했어요.'
    : performance.signals.includes('recent_struggle')
      ? '최근 달성률을 보고 부담을 한 단계 낮췄어요.'
      : '수행 기록이 적어 안전한 시작 단계를 유지했어요.';
  return {
    agent: 'safety_agent',
    finalDifficulty,
    adjustments,
    reason: `${profile.reason} ${performanceReason} 최종 권장 난이도는 ${label}이에요.`,
  };
}

export function runDifficultyAgents(profileInput, performance, request = {}) {
  const profile = assessFitnessProfile(profileInput);
  const adjusted = adjustForPerformance(profile, performance, request);
  const reviewed = reviewDifficulty(profile, adjusted);
  return {
    recommendedDifficultyCode: reviewed.finalDifficulty,
    reason: reviewed.reason,
    bmi: profile.bmi,
    engineVersion: DIFFICULTY_ADVISOR_VERSION,
    agentTrace: [profile, adjusted, reviewed],
  };
}

@Injectable()
@Dependencies(DatabaseService, AiClient)
export class DifficultyAdvisorService {
  logger = new Logger(DifficultyAdvisorService.name);

  constructor(database, ai) {
    this.database = database;
    this.ai = ai;
  }

  async recommend(userId, request = {}) {
    const [profileResult, performanceResult] = await Promise.all([
      this.database.query(
        'SELECT age, height_cm, weight_kg FROM profiles WHERE user_id = $1',
        [userId],
      ),
      this.database.query(
        `SELECT count(*) FILTER (WHERE status <> 'cancelled')::int AS planned,
                count(*) FILTER (WHERE status = 'completed')::int AS completed
           FROM missions
          WHERE user_id = $1 AND deleted_at IS NULL
            AND scheduled_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 28`,
        [userId],
      ),
    ]);
    const row = profileResult.rows[0];
    if (!row) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'not_found',
        '프로필을 찾을 수 없음',
      );
    }

    const ruleResult = runDifficultyAgents(
      {
        age: row.age,
        heightCm: row.height_cm === null ? null : Number(row.height_cm),
        weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
      },
      performanceResult.rows[0],
      request,
    );
    const result = await this.runAiAgents(
      {
        age: row.age,
        heightCm: row.height_cm === null ? null : Number(row.height_cm),
        weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
      },
      performanceResult.rows[0],
      request,
      ruleResult,
    );
    const difficulty = await this.database.query(
      'SELECT id FROM difficulty_levels WHERE code = $1 AND is_active',
      [result.recommendedDifficultyCode],
    );
    const difficultyId = difficulty.rows[0]?.id;
    if (!difficultyId) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'difficulty_unavailable',
        '사용 가능한 난이도가 없음',
      );
    }

    await this.database.withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO difficulty_recommendation_runs
                (id, user_id, source_mode, requested_difficulty_code,
                 candidate_difficulty_code, final_difficulty_id,
                 profile_agent_output, performance_agent_output, safety_agent_output)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
        [
          newId(),
          userId,
          request.mode ?? 'manual',
          request.requestedDifficultyCode ?? null,
          result.agentTrace[1].candidate,
          difficultyId,
          JSON.stringify(result.agentTrace[0]),
          JSON.stringify(result.agentTrace[1]),
          JSON.stringify(result.agentTrace[2]),
        ],
      );
      await tx.query(
        `UPDATE profiles
            SET recommended_difficulty_id = $2, difficulty_reason = $3,
                difficulty_reviewed_at = now(), updated_at = now()
          WHERE user_id = $1`,
        [userId, difficultyId, result.reason],
      );
    });
    return result;
  }

  async runAiAgents(profile, performance, request, fallback) {
    if (!this.ai.enabled) return fallback;
    try {
      const response = await this.ai.post(
        '/llm/difficulty-recommendations',
        {
          ingestKey: `difficulty:${newId()}`,
          profile,
          performance: {
            planned: Number(performance.planned ?? 0),
            completed: Number(performance.completed ?? 0),
          },
          request,
          ruleRecommendation: {
            recommendedDifficultyCode: fallback.recommendedDifficultyCode,
            reason: fallback.reason,
            bmi: fallback.bmi,
          },
        },
        { timeoutMs: this.ai.planTimeoutMs },
      );
      const body = response.body;
      const validDifficulty = ['easy', 'normal', 'hard'].includes(
        body?.recommendedDifficultyCode,
      );
      const validTrace =
        Array.isArray(body?.agentTrace) &&
        body.agentTrace.length === 3 &&
        body.agentTrace[0]?.agent === 'profile_agent' &&
        body.agentTrace[1]?.agent === 'performance_agent' &&
        body.agentTrace[2]?.agent === 'safety_agent';
      if (
        !validDifficulty ||
        !validTrace ||
        !body?.reason ||
        !body?.suggestedGoal?.title
      ) {
        throw new Error('AI difficulty response is invalid');
      }
      return {
        recommendedDifficultyCode: body.recommendedDifficultyCode,
        reason: body.reason,
        bmi: fallback.bmi,
        engineVersion: body.engineVersion ?? 'gemini-difficulty-agents@2.0.0',
        agentTrace: body.agentTrace,
        suggestedGoal: body.suggestedGoal,
      };
    } catch (error) {
      this.logger.warn(
        `AI 난이도 에이전트 실패, 규칙 기반으로 대체: ${error.message}`,
      );
      return {
        ...fallback,
        suggestedGoal: this.fallbackGoal(fallback.recommendedDifficultyCode),
      };
    }
  }

  fallbackGoal(difficultyCode) {
    const settings = {
      easy: { targetFrequency: 3, dailyAvailableMinutes: 15 },
      normal: { targetFrequency: 4, dailyAvailableMinutes: 25 },
      hard: { targetFrequency: 5, dailyAvailableMinutes: 35 },
    }[difficultyCode];
    return {
      title: '한 달 운동 습관 만들기',
      description:
        '회원정보와 최근 수행 기록을 바탕으로 안전하게 시작하는 목표예요.',
      categoryCode: 'exercise',
      difficultyCode,
      durationDays: 30,
      ...settings,
    };
  }
}
