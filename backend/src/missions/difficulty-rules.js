/**
 * 세부 미션 난이도 판정 규칙 (보상은 미션마다, 최종 목표에는 보상 없음)
 *
 * 사용자가 직접 쓴 미션·규칙 계획·빈 주 채우기가 모두 이 규칙으로 난이도를 정한다.
 * 정해진 난이도로 관리자 보상표(분야×난이도)의 포인트가 미션을 만들 때 고정된다.
 * AI가 금액을 정하는 경로는 없다. AI 서버에 난이도 판정 API가 생기면 assessDifficulty만 바꾸면 된다.
 *
 * 판정 순서
 *  1) 운동 종류가 있으면 목표 수치(횟수·초·미터)로
 *  2) 예상 소요 시간이 있으면 시간으로
 *  3) 단위가 시간·분·km면 그 값으로
 *  4) 정보가 없으면 쉬움 (수치나 시간을 적으면 올라갈 수 있다고 안내)
 */
export const DIFFICULTY_RULES_VERSION = 'difficulty-rules@1';

// [보통 시작값, 어려움 시작값]
const EXERCISE_THRESHOLDS = {
  push_up: [15, 40], // 회
  burpee: [10, 25], // 회
  squat: [20, 60], // 회
  lunge: [20, 50], // 회
  plank: [45, 75], // 초 (목표 범위 10~90초)
  running: [3000, 10000], // 미터
};
const MINUTE_THRESHOLDS = [20, 50]; // 20분 이상 보통, 50분 이상 어려움
const KM_THRESHOLDS = [3, 10];

const NAMES = { easy: '쉬움', normal: '보통', hard: '어려움' };

function tier(value, [normal, hard]) {
  if (value >= hard) return 'hard';
  if (value >= normal) return 'normal';
  return 'easy';
}

function minutesFromUnit(value, unit) {
  const u = String(unit ?? '')
    .trim()
    .toLowerCase();
  if (['분', 'min', 'mins', 'minute', 'minutes'].includes(u)) return value;
  if (['시간', 'h', 'hr', 'hour', 'hours'].includes(u)) return value * 60;
  if (['초', 's', 'sec', 'seconds'].includes(u)) return value / 60;
  return null;
}

/**
 * @param {{exerciseCode?: string|null, targetValue?: number|null, targetUnit?: string|null,
 *   estimatedDurationSeconds?: number|null}} mission
 * @returns {{difficultyCode: 'easy'|'normal'|'hard', reason: string, basis: string}}
 */
export function assessDifficulty(mission) {
  const value =
    mission.targetValue === null || mission.targetValue === undefined
      ? null
      : Number(mission.targetValue);
  const seconds = mission.estimatedDurationSeconds ?? null;

  const thresholds = EXERCISE_THRESHOLDS[mission.exerciseCode];
  if (thresholds && value !== null) {
    const code = tier(value, thresholds);
    return {
      difficultyCode: code,
      basis: 'exercise',
      reason: `운동 목표 수치 기준 ${NAMES[code]}`,
    };
  }
  if (seconds) {
    const code = tier(seconds / 60, MINUTE_THRESHOLDS);
    return {
      difficultyCode: code,
      basis: 'duration',
      reason: `예상 소요 시간 기준 ${NAMES[code]}`,
    };
  }
  if (value !== null) {
    const minutes = minutesFromUnit(value, mission.targetUnit);
    if (minutes !== null) {
      const code = tier(minutes, MINUTE_THRESHOLDS);
      return {
        difficultyCode: code,
        basis: 'duration',
        reason: `목표 시간 기준 ${NAMES[code]}`,
      };
    }
    if (
      ['km', '킬로미터'].includes(
        String(mission.targetUnit ?? '')
          .trim()
          .toLowerCase(),
      )
    ) {
      const code = tier(value, KM_THRESHOLDS);
      return {
        difficultyCode: code,
        basis: 'distance',
        reason: `목표 거리 기준 ${NAMES[code]}`,
      };
    }
  }
  return {
    difficultyCode: 'easy',
    basis: 'default',
    reason:
      '정보가 적어 쉬움으로 정했어요. 목표 수치나 소요 시간을 적으면 올라갈 수 있어요',
  };
}

export const difficultyName = (code) => NAMES[code] ?? code;
