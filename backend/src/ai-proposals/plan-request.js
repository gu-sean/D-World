import { EXERCISE_TYPES } from '../goals/exercise-types.js';

/**
 * I03 요청 본문 (AI 계약 GoalPlanRequest, ai/app/schemas/contracts.py)
 * @param {object} goal 목표 행(goals) + categoryCode·difficultyCode
 */
export function buildGoalPlanRequest({
  goal,
  categoryCode,
  difficultyCode,
  today,
  generationNo,
  previousSummary,
}) {
  return {
    ingestKey: `goal-plan:${goal.id}:${generationNo}`,
    today,
    goal: {
      title: goal.title,
      description: goal.description ?? null,
      categoryCode,
      difficultyCode,
      startDate: goal.start_date,
      endDate: goal.end_date,
      targetFrequency: goal.target_frequency ?? null,
      dailyAvailableMinutes: goal.daily_available_minutes ?? null,
    },
    exerciseTypes: EXERCISE_TYPES.map((type) => ({ ...type })),
    generationNo,
    previousSummary: previousSummary ?? null,
  };
}

/**
 * I03 응답(GoalPlanResponse) → 저장할 proposal_json
 * 단계가 없으면 쓸 수 없는 결과라 null (호출한 쪽이 AI_INVALID_OUTPUT으로 처리)
 */
export function toProposalJson(response) {
  const proposal = response?.proposal;
  if (
    !proposal ||
    !Array.isArray(proposal.steps) ||
    proposal.steps.length === 0
  ) {
    return null;
  }
  return {
    summary: proposal.summary ?? null,
    steps: proposal.steps,
    engineVersion: response.engineVersion ?? null,
  };
}
