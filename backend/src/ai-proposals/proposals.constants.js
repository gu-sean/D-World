// 설계서 "확인이 필요한 것" 5번의 제안값: 초안이 며칠 뒤 만료되는지
export const PROPOSAL_EXPIRY_DAYS = 7;
// 한 번의 수락으로 만들 수 있는 미션 수 (남용·긴 트랜잭션 방지)
export const MAX_PLAN_MISSIONS = 100;

export const PROPOSAL_STATUSES = ['draft', 'accepted', 'rejected', 'expired'];
