/**
 * 고유 제약 위반(23505)을 제약 이름별 도메인 오류로 변환, 해당 없으면 원래 오류를 그대로 던짐
 * DB 고유 인덱스가 최종 판단이므로 사전 조회는 UX용일 뿐 경쟁 상태는 여기서 처리
 * map: { [constraint]: () => Error }
 */
export function rethrowConstraint(error, map) {
  if (error?.code === '23505' && map[error.constraint])
    throw map[error.constraint]();
  throw error;
}
