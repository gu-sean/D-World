/**
 * `linkScreen` → 앱 화면 이름·파라미터 (07 §17).
 *
 * 알림(`user_notifications.link_screen`)·공지가 주는 문자열을 화면 이름으로 바꾼다.
 * 실제 이동은 `navigation/linking.js`(최정훈)가 한다 — 여기서는 `{name, params}`만 만든다.
 *
 * 표에 없는 값은 모두 `{name: 'home', params: {}}`.
 */

const HOME = { name: 'home', params: {} };

/**
 * 07 §17 표. 고정 경로는 그대로, 값이 끼는 경로는 조각을 비교한다.
 * 조각 패턴의 `:이름`은 그 자리의 값을 `params`에 담는다.
 */
const ROUTES = [
  { pattern: 'home', name: 'home' },
  { pattern: 'missions/:missionId', name: 'missionDetail' },
  { pattern: 'records/:recordId', name: 'recordResult' },
  { pattern: 'reports', name: 'reports' },
  { pattern: 'reports/ai/:runId', name: 'aiReport' },
  { pattern: 'adjustments/:adjustmentId', name: 'planAdjustment' },
  { pattern: 'pets', name: 'pets' },
  { pattern: 'achievements', name: 'achievements' },
  { pattern: 'streak', name: 'streak' },
  { pattern: 'challenges/:challengeId', name: 'challengeDetail' },
  { pattern: 'challenges/:challengeId/result', name: 'challengeResult' },
  { pattern: 'notices/:noticeId', name: 'noticeDetail' },
  { pattern: 'support/:ticketId', name: 'supportTicket' },
];

/**
 * @param {string|null|undefined} linkScreen 예: `'missions/7b2a6f0e-…'`
 * @returns {{name: string, params: Record<string, string>}}
 */
export function parseLinkScreen(linkScreen) {
  if (typeof linkScreen !== 'string') return { ...HOME };
  const path = linkScreen.trim().replace(/^\/+|\/+$/g, '');
  if (path === '') return { ...HOME };

  const parts = path.split('/');
  for (const route of ROUTES) {
    const pattern = route.pattern.split('/');
    if (pattern.length !== parts.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < pattern.length; i += 1) {
      if (pattern[i].startsWith(':')) {
        if (parts[i] === '') { matched = false; break; }
        params[pattern[i].slice(1)] = parts[i];
      } else if (pattern[i] !== parts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { name: route.name, params };
  }

  return { ...HOME };
}

/** 07 §17이 정의한 화면 이름 전부 (테스트·화면 쪽 점검용). */
export const LINK_SCREEN_NAMES = [...new Set(ROUTES.map((r) => r.name))];

export default parseLinkScreen;
