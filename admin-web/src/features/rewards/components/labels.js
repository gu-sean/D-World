export const TRANSACTION_KINDS = {
  auto_award: '자동 지급',
  award_offset: '지급 상쇄',
  spend: '사용',
  refund: '환불',
  refund_offset: '환불 상쇄',
  recovery: '회수',
  recovery_claim: '회수 청구',
  recovery_settlement: '회수 정산',
  recovery_cancel: '회수 취소',
  reinstatement: '복원',
  manual_grant: '수동 지급',
  manual_recovery: '수동 회수',
};

export const SOURCE_TYPES = {
  mission: '미션',
  streak: '스트릭',
  achievement: '업적',
  challenge: '챌린지',
  shop_order: '상점 주문',
  admin_adjustment: '관리자 조정',
};

export const RARITIES = { common: '일반', rare: '희귀', legendary: '전설' };
export const VERSION_STATUS = { draft: '임시 저장', public: '공개', hidden: '숨김' };

export const ACHIEVEMENT_CONDITIONS = {
  first_goal_completed: '첫 목표 완료',
  approved_mission_count: '승인된 미션 수',
  category_approved_mission_count: '분야별 승인된 미션 수',
  streak_milestone: '스트릭 마일스톤',
};

export const UNLOCK_CONDITIONS = {
  none: '조건 없음',
  approved_mission_count: '승인된 미션 수',
  category_approved_mission_count: '분야별 승인된 미션 수',
  streak_milestone: '스트릭 마일스톤',
  achievement_earned: '업적 달성',
};

export const STAGE_NAMES = { 1: '알', 2: '새끼', 3: '성체' };
export const STREAK_TARGET_DAYS = [7, 30, 100];

export const MAX_POINTS = 1_000_000;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
