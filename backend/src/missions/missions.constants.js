// 남용 방지 상한 (docs/backend/04-goals-missions-design.md "확인이 필요한 것" 1번의 제안값)
export const MAX_MISSIONS_PER_DAY = 20; // 사용자·예정일별 (취소·삭제 제외)
export const MAX_DATES_PER_REQUEST = 31;
export const MAX_SCHEDULE_AHEAD_DAYS = 366; // 오늘부터 며칠 뒤까지 예약할 수 있는지
export const MAX_RANGE_DAYS = 62; // 목록 조회의 날짜 범위

export const MISSION_STATUSES = [
  'scheduled',
  'in_progress',
  'submitted',
  'completed',
  'failed',
  'cancelled',
];
export const VERIFICATION_METHODS = ['camera', 'sensor'];
