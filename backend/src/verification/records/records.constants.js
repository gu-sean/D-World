// 정책 05: 인증 제출은 미션당 최대 4회(최초 + 재시도 3회), 업로드 실패로 제출이 안 된 회차는 세지 않음
export const MAX_SUBMISSIONS = 4;

/** 새 수행 회차를 시작할 수 있는 미션 상태 (submitted는 검수 대기·판정 대기 중 재시도를 허용하기 위함) */
export const STARTABLE_MISSION_STATUSES = [
  'scheduled',
  'in_progress',
  'submitted',
];

/** 제출 전 회차 상태 */
export const OPEN_RECORD_STATUSES = ['recording', 'uploading'];

/** 이의 제기 기한: 사용자에게 결과를 안내한 시각부터 7일 */
export const APPEAL_WINDOW = '7 days';
