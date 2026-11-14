import { newId } from '../common/ids.js';

/** AI에 보낼 후보 최대 수 (AI 계약 candidates 1~20) */
export const MAX_CANDIDATES = 20;

const WEATHERS = new Set([
  'clear',
  'clouds',
  'rain',
  'snow',
  'hot',
  'cold',
  'dust',
]);

/**
 * I04 요청 본문 (AI 계약 SituationalRecommendationRequest, ai/app/schemas/contracts.py)
 * 좌표는 담지 않는다: 날씨는 이미 조회했고 AI에는 결과만 준다.
 */
export function buildSituationRequest({
  kind,
  context,
  profile,
  candidates,
  maxResults,
}) {
  return {
    ingestKey: `situational:${newId()}`,
    context: {
      weather: WEATHERS.has(context.weather) ? context.weather : 'unknown',
      temperatureC: context.temperatureC ?? null,
      timeSlot: context.timeSlot,
      isMoving: Boolean(context.isMoving),
      kind,
    },
    profile,
    candidates: candidates.slice(0, MAX_CANDIDATES).map((def) => ({
      definitionId: def.id,
      title: def.title,
      categoryCode: def.category_code,
      exerciseCode: def.exercise_code ?? null,
      estimatedDurationSeconds: def.estimated_duration_seconds ?? null,
      isOutdoor: def.exercise_code === 'running',
    })),
    maxResults,
  };
}

/**
 * I04 응답을 검증해 [{ def, reason }]으로 바꾼다. 하나라도 규칙에 어긋나면 null
 * (AI가 후보 밖 id, 중복, 순위 불연속, 개수 초과를 주면 믿지 않고 규칙 기반으로 대체)
 */
export function pickFromAiResponse(body, sent, maxResults) {
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length > maxResults) return null;

  const byId = new Map(sent.map((def) => [def.id, def]));
  const seen = new Set();
  const picked = [];
  for (const [index, item] of items.entries()) {
    const def = byId.get(item?.definitionId);
    if (!def || seen.has(def.id)) return null;
    if (item.rankNo !== index + 1) return null;
    seen.add(def.id);
    const reason = String(item.reason ?? '').trim();
    picked.push({ def, reason: reason ? reason.slice(0, 200) : null });
  }
  return picked;
}
