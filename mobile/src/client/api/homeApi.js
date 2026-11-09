/**
 * 08 §4 홈 (A29).
 */
import { request } from '../http/httpClient.js';

/**
 * A29 홈 요약. `date`를 생략하면 서버가 오늘(KST)로 본다.
 * 오늘 −30일 ~ +7일만 허용한다.
 * @param {string} [date] `YYYY-MM-DD`
 * @returns {Promise<object>} `HomeSummary`
 */
export function getHome(date) {
  return request({ method: 'GET', path: '/home', query: { date } });
}

export default { getHome };
