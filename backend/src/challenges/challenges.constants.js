/** 챌린지 기간(일), DB CHECK과 같음 */
export const DURATIONS = [7, 14, 30];

/** DB의 exercise_code CHECK과 같은 목록, running만 센서 인증 */
export const EXERCISE_CODES = [
  'push_up',
  'burpee',
  'squat',
  'lunge',
  'plank',
  'running',
];

/** 챌린지 점수 = 성공 일수 × 100 (정책 15) */
export const POINTS_PER_SUCCESS_DAY = 100;

/** 목록 필터: 시작 전(모집 중) / 진행 중 / 종료 */
export const PHASES = ['recruiting', 'ongoing', 'ended'];

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

/** 사용자가 동시에 가질 수 있는 미완료 개설 챌린지 수(초안·검수 중·반려·진행 전/중인 공개) */
export const MAX_OPEN_CREATED = 5;
