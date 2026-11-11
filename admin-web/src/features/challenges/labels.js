// Korean labels of the challenge enums (values are the backend's).
export const PUBLICATION_STATUS = {
  draft: { label: '초안', color: 'default' },
  review_pending: { label: '검수 대기', color: 'gold' },
  public: { label: '공개', color: 'green' },
  rejected: { label: '반려', color: 'red' },
  hidden: { label: '숨김', color: 'orange' },
  cancelled: { label: '취소', color: 'volcano' },
};
export const PHASE = { recruiting: '모집 중', ongoing: '진행 중', ended: '종료' };
export const ORIGIN = { admin: '공식', user: '사용자' };
export const SETTLEMENT_STATUS = {
  not_started: '정산 전',
  draft: '정산 초안',
  confirmed: '정산 확정',
};
export const OUTCOME = {
  completed: '완주',
  failed: '실패',
  withdrawn: '포기',
  disqualified: '실격',
};
export const PAYMENT_STATUS = {
  none: { label: '해당 없음', color: 'default' },
  pending: { label: '지급 대기', color: 'gold' },
  paid: { label: '지급 완료', color: 'green' },
  failed: { label: '지급 실패', color: 'red' },
};
export const RUN_STATUS = { draft: '초안', confirmed: '확정', superseded: '대체됨' };
export const PARTICIPATION_STATUS = {
  enrolled: '참가 중',
  completed: '완주',
  failed: '실패',
  withdrawn: '포기',
  disqualified: '실격',
};
export const DAY_STATUS = {
  pending: '대기',
  success: '성공',
  failed: '실패',
  excluded: '제외',
  cancelled: '취소',
};
export const VERIFICATION_METHOD = { camera: '카메라', sensor: '센서' };
export const EXERCISE = {
  push_up: '푸시업',
  burpee: '버피',
  squat: '스쿼트',
  lunge: '런지',
  plank: '플랭크',
  running: '달리기',
};
export const BLOCKER_LABEL = {
  notEnded: '아직 종료되지 않았어요.',
  pendingDays: '판정 대기 중인 일별 결과가 있어요.',
  waitingSubmissions: '검수·이의 제기 대기 중인 제출이 있어요.',
  incompleteParticipants: '일별 기록이 모두 만들어지지 않은 참가자가 있어요.',
};
export const label = (map, key) => {
  const value = map[key];
  return (typeof value === 'object' ? value?.label : value) ?? key ?? '-';
};
