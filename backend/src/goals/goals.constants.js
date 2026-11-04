// 남용 방지 상한 (docs/backend/04-goals-missions-design.md "확인이 필요한 것" 1번의 제안값)
export const MAX_ACTIVE_GOALS = 20; // 삭제·완료되지 않은(active, paused) 목표 수
export const MAX_STEPS_PER_GOAL = 30;
export const MAX_GOAL_PERIOD_DAYS = 366;

export const GOAL_STATUSES = ['active', 'paused', 'completed'];
