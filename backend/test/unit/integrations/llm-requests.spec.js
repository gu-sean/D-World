import { randomUUID } from 'node:crypto';
import {
  llmErrorCode,
  toLlmException,
} from '../../../src/integrations/ai/ai-errors.js';
import {
  buildGoalPlanRequest,
  toProposalJson,
} from '../../../src/ai-proposals/plan-request.js';
import {
  buildSituationRequest,
  MAX_CANDIDATES,
  pickFromAiResponse,
} from '../../../src/recommendations/situation-request.js';

describe('llmErrorCode', () => {
  it('AI가 준 코드는 그대로', () => {
    expect(llmErrorCode({ code: 'AI_LLM_UNAVAILABLE', status: 503 })).toBe(
      'AI_LLM_UNAVAILABLE',
    );
    expect(llmErrorCode({ code: 'AI_INVALID_OUTPUT', status: 502 })).toBe(
      'AI_INVALID_OUTPUT',
    );
  });

  it('코드 없는 502는 형식 오류, 타임아웃은 AI_TIMEOUT', () => {
    expect(llmErrorCode({ status: 502, code: null })).toBe('AI_INVALID_OUTPUT');
    expect(llmErrorCode({ status: 0, timedOut: true })).toBe('AI_TIMEOUT');
  });

  it('연결 실패·그 밖의 오류는 AI_LLM_UNAVAILABLE', () => {
    expect(llmErrorCode({ status: 0 })).toBe('AI_LLM_UNAVAILABLE');
    expect(llmErrorCode({ status: 500 })).toBe('AI_LLM_UNAVAILABLE');
    expect(llmErrorCode({ status: 400, code: 'AI_INVALID_REQUEST' })).toBe(
      'AI_LLM_UNAVAILABLE',
    );
  });

  it('예외는 표의 상태 코드', () => {
    expect(toLlmException({ timedOut: true }).getStatus()).toBe(504);
    expect(toLlmException({ status: 502 }).getStatus()).toBe(502);
    expect(toLlmException({ status: 0 }).getStatus()).toBe(503);
  });
});

describe('buildGoalPlanRequest', () => {
  const goal = {
    id: randomUUID(),
    title: '스쿼트 꾸준히',
    description: null,
    start_date: '2026-11-09',
    end_date: '2026-11-29',
    target_frequency: 3,
    daily_available_minutes: 20,
  };

  it('AI 계약(GoalPlanRequest) 모양', () => {
    const body = buildGoalPlanRequest({
      goal,
      categoryCode: 'exercise',
      difficultyCode: 'easy',
      today: '2026-11-09',
      generationNo: 2,
      previousSummary: '이전 요약',
    });
    expect(body).toMatchObject({
      ingestKey: `goal-plan:${goal.id}:2`,
      today: '2026-11-09',
      goal: {
        title: '스쿼트 꾸준히',
        description: null,
        categoryCode: 'exercise',
        difficultyCode: 'easy',
        startDate: '2026-11-09',
        endDate: '2026-11-29',
        targetFrequency: 3,
        dailyAvailableMinutes: 20,
      },
      generationNo: 2,
      previousSummary: '이전 요약',
    });
    expect(body.ingestKey.startsWith('goal-plan:')).toBe(true);
    expect(body.exerciseTypes).toHaveLength(6);
    expect(body.exerciseTypes[0]).toEqual({
      code: 'push_up',
      name: '푸시업',
      verificationMethod: 'camera',
      targetUnit: 'reps',
      minTarget: 1,
      maxTarget: 100,
    });
  });
});

describe('toProposalJson', () => {
  it('응답을 저장 모양으로, 단계가 없으면 null', () => {
    const steps = [
      { stepNo: 1, title: 'a', dueDate: '2026-11-10', missions: [] },
    ];
    expect(
      toProposalJson({
        engineVersion: 'gemini-goals@0.1.0',
        proposal: { summary: '요약', steps },
      }),
    ).toEqual({ summary: '요약', steps, engineVersion: 'gemini-goals@0.1.0' });
    expect(
      toProposalJson({ proposal: { summary: 'x', steps: [] } }),
    ).toBeNull();
    expect(toProposalJson({})).toBeNull();
    expect(toProposalJson(null)).toBeNull();
  });
});

describe('situational recommendation contract', () => {
  const def = (extra = {}) => ({
    id: randomUUID(),
    title: '스쿼트 20개',
    category_code: 'exercise',
    exercise_code: 'squat',
    estimated_duration_seconds: 600,
    ...extra,
  });
  const profile = {
    activeGoalCategories: ['exercise'],
    recentCompletionRate: 0.5,
    streakDays: 3,
    recentExerciseCount: 4,
    availableMinutes: 30,
  };

  it('요청: 좌표 없이 날씨 결과만, 후보는 20개까지, 러닝은 실외', () => {
    const candidates = Array.from({ length: 25 }, (_, i) =>
      def({ exercise_code: i === 0 ? 'running' : 'squat' }),
    );
    const body = buildSituationRequest({
      kind: 'weather',
      context: {
        weather: 'clear',
        temperatureC: 21,
        timeSlot: 'morning',
        isMoving: false,
        outdoorSuitable: true,
      },
      profile,
      candidates,
      maxResults: 3,
    });
    expect(body.context).toEqual({
      weather: 'clear',
      temperatureC: 21,
      timeSlot: 'morning',
      isMoving: false,
      kind: 'weather',
    });
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude/);
    expect(body.candidates).toHaveLength(MAX_CANDIDATES);
    expect(body.candidates[0]).toMatchObject({ isOutdoor: true });
    expect(body.candidates[1]).toMatchObject({
      categoryCode: 'exercise',
      exerciseCode: 'squat',
      isOutdoor: false,
    });
    expect(body.maxResults).toBe(3);
    expect(body.profile).toEqual(profile);
  });

  it('날씨를 모르거나 다른 값이면 unknown', () => {
    const base = {
      kind: 'moving',
      profile,
      candidates: [def()],
      maxResults: 3,
    };
    const ctx = { timeSlot: 'night', isMoving: true };
    expect(
      buildSituationRequest({ ...base, context: { ...ctx, weather: null } })
        .context.weather,
    ).toBe('unknown');
    expect(
      buildSituationRequest({ ...base, context: { ...ctx, weather: 'other' } })
        .context.weather,
    ).toBe('unknown');
  });

  it('응답 검증: 후보 안의 id, 중복 없음, 순위 연속, 개수 이내', () => {
    const a = def();
    const b = def();
    const ok = pickFromAiResponse(
      {
        items: [
          { rankNo: 1, definitionId: b.id, reason: '이유 1' },
          { rankNo: 2, definitionId: a.id, reason: ' 이유 2 ' },
        ],
      },
      [a, b],
      3,
    );
    expect(ok.map((p) => p.def.id)).toEqual([b.id, a.id]);
    expect(ok[1].reason).toBe('이유 2');

    const bad = [
      { items: [] },
      { items: [{ rankNo: 1, definitionId: randomUUID(), reason: 'x' }] },
      {
        items: [
          { rankNo: 1, definitionId: a.id, reason: 'x' },
          { rankNo: 2, definitionId: a.id, reason: 'x' },
        ],
      },
      { items: [{ rankNo: 2, definitionId: a.id, reason: 'x' }] },
      {
        items: [
          { rankNo: 1, definitionId: a.id, reason: 'x' },
          { rankNo: 2, definitionId: b.id, reason: 'x' },
        ],
      },
      {},
      null,
    ];
    for (const [index, body] of bad.entries()) {
      expect(pickFromAiResponse(body, [a, b], index === 4 ? 1 : 3)).toBeNull();
    }
  });

  it('이유가 비어 있으면 null로 두어 규칙 기반 문구를 쓰게 함', () => {
    const a = def();
    const [picked] = pickFromAiResponse(
      { items: [{ rankNo: 1, definitionId: a.id, reason: '  ' }] },
      [a],
      3,
    );
    expect(picked.reason).toBeNull();
  });
});
