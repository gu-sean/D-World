// Shared labels and limits of the mission screens. Values follow the backend validation.

export const EXERCISE_OPTIONS = [
  { value: 'push_up', label: '푸시업' },
  { value: 'burpee', label: '버피' },
  { value: 'squat', label: '스쿼트' },
  { value: 'lunge', label: '런지' },
  { value: 'plank', label: '플랭크' },
  { value: 'running', label: '달리기' },
];

export const METHOD_OPTIONS = [
  { value: 'camera', label: '카메라' },
  { value: 'sensor', label: '센서' },
];

// All statuses a definition list can be filtered by (PUBLICATION_STATUSES of the backend).
export const STATUS_LABELS = {
  private: '비공개',
  review_pending: '검수 대기',
  public: '공개',
  rejected: '반려',
  hidden: '숨김',
  draft: '임시 저장',
};

// Statuses an admin may set on an admin definition (ADMIN_STATUSES of the backend).
export const ADMIN_STATUS_OPTIONS = [
  { value: 'public', label: '공개' },
  { value: 'draft', label: '임시 저장' },
  { value: 'hidden', label: '숨김' },
];

export const ORIGIN_LABELS = { admin: '관리자', user: '사용자' };

export const labelOf = (options, value) =>
  options.find((option) => option.value === value)?.label ?? value ?? '-';

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('ko-KR', { hour12: false }) : '-';

export const PAGE_SIZE = 20;
