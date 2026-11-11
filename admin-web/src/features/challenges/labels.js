// Texts that constants/labels.js (AW-05) does not have. Status texts of publication, settlement,
// participation and daily missions come from there (StatusTag).
export const PHASE = { recruiting: '모집 중', ongoing: '진행 중', ended: '종료' };
export const ORIGIN = { admin: '공식', user: '사용자' };
export const PAYMENT_STATUS = {
  none: { label: '해당 없음', color: 'default' },
  pending: { label: '지급 대기', color: 'warning' },
  paid: { label: '지급 완료', color: 'success' },
  failed: { label: '지급 실패', color: 'error' },
};
export const RUN_STATUS = { draft: '초안', confirmed: '확정', superseded: '대체됨' };
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

/** antd Select options from a plain `{value: text}` map */
export const toOptions = (map) =>
  Object.entries(map).map(([value, item]) => ({
    value,
    label: typeof item === 'object' ? item.label : item,
  }));
