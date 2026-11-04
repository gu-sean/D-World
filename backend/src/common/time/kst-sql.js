/** 현재 KST 날짜(DB 시각 기준), 쿼리 문자열에 삽입해서 사용 */
export const TODAY_SQL = "(now() AT TIME ZONE 'Asia/Seoul')::date";
