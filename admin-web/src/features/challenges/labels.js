import { t } from '../../i18n/index.js';
// Texts that constants/labels.js (AW-05) does not have. Status texts of publication, settlement,
// participation and daily missions come from there (StatusTag).
export const PHASE = { recruiting: t('모집 중'), ongoing: t('진행 중'), ended: t('종료') };
export const ORIGIN = { admin: t('공식'), user: t('사용자') };
export const PAYMENT_STATUS = {
  none: { label: t('해당 없음'), color: 'default' },
  pending: { label: t('지급 대기'), color: 'warning' },
  paid: { label: t('지급 완료'), color: 'success' },
  failed: { label: t('지급 실패'), color: 'error' },
};
export const RUN_STATUS = { draft: t('초안'), confirmed: t('확정'), superseded: t('대체됨') };
export const VERIFICATION_METHOD = { camera: t('카메라'), sensor: t('센서') };
export const EXERCISE = {
  push_up: t('푸시업'),
  burpee: t('버피'),
  squat: t('스쿼트'),
  lunge: t('런지'),
  plank: t('플랭크'),
  running: t('달리기'),
};
export const BLOCKER_LABEL = {
  notEnded: t('아직 종료되지 않았어요.'),
  pendingDays: t('판정 대기 중인 일별 결과가 있어요.'),
  waitingSubmissions: t('검수·이의 제기 대기 중인 제출이 있어요.'),
  incompleteParticipants: t('일별 기록이 모두 만들어지지 않은 참가자가 있어요.'),
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
