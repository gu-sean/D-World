import dayjs from 'dayjs';

// Labels of the status values the backend sends for verification records and appeals.
export const RECORD_STATUS = {
  review_required: { label: '검수 대기', color: 'orange' },
  approved: { label: '승인', color: 'green' },
  rejected: { label: '거절', color: 'red' },
  submitted: { label: '제출됨', color: 'default' },
};

export const APPEAL_STATUS = {
  open: { label: '처리 대기', color: 'orange' },
  accepted: { label: '이의 인정', color: 'green' },
  rejected: { label: '기각', color: 'red' },
};

export const METHOD_LABEL = { camera: '카메라', sensor: '센서' };
export const SOURCE_LABEL = { ai: 'AI', admin: '관리자', system: '시스템' };
export const DECISION_LABEL = {
  approved: '승인',
  rejected: '거절',
  review_required: '검수 필요',
};

/** @param {string|null|undefined} value ISO timestamp, shown in Asia/Seoul (set in providers.jsx) */
export const formatDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-');

/** @param {number|null|undefined} value 0~1 */
export const formatConfidence = (value) => (value == null ? '-' : `${Math.round(value * 100)}%`);

/** @param {{targetValue?: number|null, targetUnit?: string|null}} mission */
export const formatTarget = (mission) =>
  mission.targetValue == null ? '-' : `${mission.targetValue}${mission.targetUnit ?? ''}`;

/** Reason rules of the backend: required, not only spaces, at most `max` characters. */
export const reasonRules = (max) => [
  { required: true, message: '사유를 입력해 주세요.' },
  { max, message: `사유는 ${max}자 이하로 입력해 주세요.` },
  {
    validator: (_, value) =>
      value && !value.trim()
        ? Promise.reject(new Error('공백만 입력할 수 없어요.'))
        : Promise.resolve(),
  },
];
