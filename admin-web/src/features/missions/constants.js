// Option lists of the mission forms. Values follow the backend validation. Status texts come from
// constants/labels.js (StatusTag), so they are not repeated here.

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

// Statuses an admin may set on an admin definition (ADMIN_STATUSES of the backend).
export const ADMIN_STATUS_OPTIONS = [
  { value: 'public', label: '공개' },
  { value: 'draft', label: '초안' },
  { value: 'hidden', label: '숨김' },
];

// All statuses a definition list can be filtered by (PUBLICATION_STATUSES of the backend).
export const FILTER_STATUS_OPTIONS = [
  { value: 'private', label: '비공개' },
  { value: 'review_pending', label: '검수 대기' },
  { value: 'public', label: '공개' },
  { value: 'rejected', label: '반려' },
  { value: 'hidden', label: '숨김' },
  { value: 'draft', label: '초안' },
];

export const ORIGIN_OPTIONS = [
  { value: 'admin', label: '관리자' },
  { value: 'user', label: '사용자' },
];

export const labelOf = (options, value) =>
  options.find((option) => option.value === value)?.label ?? value ?? '-';
