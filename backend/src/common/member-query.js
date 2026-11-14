// 관리자 목록의 "회원" 검색 규칙 (회원 목록 M10과 같은 규칙을 모든 목록에 쓴다)
//   회원 ID 모양(8자 영숫자)이면 회원 ID와 정확히 같은 것, 아니면 닉네임 부분 일치
import { ID_PATTERN } from './ids.js';

export { ID_PATTERN };

export const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

/**
 * 검색어를 SQL 매개변수 두 개로 나눈다.
 * @param {unknown} raw 쿼리 문자열 값
 * @returns {{like: string|null, id: string|null}}
 */
export function memberQueryParams(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { like: null, id: null };
  // 8자 영숫자는 닉네임일 수도 있어서 ID 일치와 닉네임 부분 일치를 둘 다 본다
  return {
    like: `%${escapeLike(text)}%`,
    id: ID_PATTERN.test(text) ? text : null,
  };
}

/**
 * 회원 검색 WHERE 조각. 둘 다 null이면 거르지 않는다.
 * @param {string} column 회원 ID 컬럼 (예: 't.user_id')
 * @param {string} likeParam 닉네임 패턴 매개변수 (예: '$6')
 * @param {string} idParam 회원 ID 매개변수 (예: '$7')
 */
export const memberWhere = (column, likeParam, idParam) =>
  memberWhereAny([column], likeParam, idParam);

/**
 * 여러 회원 컬럼 중 하나라도 맞으면 통과 (예: 문의·신고의 접수자 또는 신고 대상)
 * @param {string[]} columns
 * @param {string} likeParam
 * @param {string} idParam
 */
export const memberWhereAny = (columns, likeParam, idParam) =>
  `((${idParam}::short_id IS NULL AND ${likeParam}::text IS NULL)
    OR ${columns.map((c) => `${c} = ${idParam}`).join(' OR ')}
    OR ${columns
      .map(
        (c) =>
          `${c} IN (SELECT mq.user_id FROM profiles mq WHERE mq.nickname ILIKE ${likeParam})`,
      )
      .join(' OR ')})`;

/** 회원 닉네임을 붙이는 SELECT 조각 */
// column은 반드시 테이블 이름·별칭을 붙여 넘긴다 ('user_id'만 쓰면 profiles의 user_id로 읽혀 모든 행이 맞는다)
export const nicknameOf = (column) =>
  `(SELECT np.nickname FROM profiles np WHERE np.user_id = ${column})`;
