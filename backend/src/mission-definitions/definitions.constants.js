// 남용 방지 상한 (설계서에 숫자가 없어 3-B-2의 상한과 비슷한 규모로 둔 제안값)
export const MAX_DEFINITIONS_PER_USER = 100; // 삭제하지 않은 내 원형 수

export const PUBLICATION_STATUSES = [
  'private',
  'review_pending',
  'public',
  'rejected',
  'hidden',
];
// 작성자가 내용을 고칠 수 있는 상태 (검수 중·공개 중에는 검수한 내용과 노출 내용이 달라지지 않게 잠금)
export const EDITABLE_STATUSES = ['private', 'rejected'];
