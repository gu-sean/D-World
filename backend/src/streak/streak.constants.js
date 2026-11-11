/** 마일스톤 기준 일수 (정책 09, DB CHECK과 같음) */
export const MILESTONES = [7, 30, 100];

/** 일별 조회 API의 최대 범위 */
export const MAX_RANGE_DAYS = 120;
export const DEFAULT_RANGE_DAYS = 35;

/** 확정 작업이 되돌아보는 일수 (더 오래된 날짜는 사용자의 다음 재계산 때 처리) */
export const UNRESOLVED_LOOKBACK_DAYS = 35;
