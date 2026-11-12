/**
 * 알림·공지의 `linkScreen` 값을 실제 화면 이동으로 바꾼다.
 *
 * 서버는 `missions/{id}` 같은 짧은 문자열을 준다. 기능 모듈의 `parseLinkScreen`이
 * 그것을 `{name, params}`로 풀어 주고, 여기서는 그 이름을 앱의 화면 이름에 맞춘다.
 * 표에 없는 값은 모두 홈으로 보낸다.
 */
import { parseLinkScreen } from '../client';
import { navigate } from './navigationRef';
import Routes from './routes';

/** `parseLinkScreen().name` → 앱 화면 이름. 탭으로 가는 것은 탭 이름을 쓴다. */
const TARGETS = {
  home: () => ({ name: Routes.HOME_TAB }),
  missionDetail: (p) => ({ name: Routes.MISSION_DETAIL, params: { missionId: p.missionId } }),
  recordResult: (p) => ({ name: Routes.VERIFY_RESULT, params: { recordId: p.recordId } }),
  reports: () => ({ name: Routes.REPORTS_TAB }),
  aiReport: (p) => ({ name: Routes.AI_REPORT_DETAIL, params: { runId: p.runId } }),
  planAdjustment: (p) => ({
    name: Routes.PLAN_ADJUST_PROPOSAL,
    params: { adjustmentId: p.adjustmentId },
  }),
  pets: () => ({ name: Routes.MY_TAB, params: { screen: Routes.PET_ROOM } }),
  achievements: () => ({ name: Routes.MY_TAB, params: { screen: Routes.ACHIEVEMENT_LIST } }),
  streak: () => ({ name: Routes.MY_TAB, params: { screen: Routes.STREAK } }),
  challengeDetail: (p) => ({
    name: Routes.CHALLENGE_DETAIL,
    params: { challengeId: p.challengeId },
  }),
  challengeResult: (p) => ({
    name: Routes.CHALLENGE_RESULT,
    params: { challengeId: p.challengeId },
  }),
  noticeDetail: (p) => ({ name: Routes.NOTICE_DETAIL, params: { noticeId: p.noticeId } }),
  supportTicket: (p) => ({
    name: Routes.SUPPORT_TICKET_DETAIL,
    params: { ticketId: p.ticketId },
  }),
};

/**
 * `linkScreen` 문자열이 가리키는 화면을 돌려준다.
 * @param {string|null|undefined} linkScreen
 * @returns {{name: string, params?: object}}
 */
export function resolveLink(linkScreen) {
  const { name, params } = parseLinkScreen(linkScreen);
  const build = TARGETS[name] ?? TARGETS.home;
  return build(params ?? {});
}

/**
 * `linkScreen`이 가리키는 화면으로 이동한다.
 * 화면 안에서는 `navigation`을, 알림 처리처럼 밖에서는 인자 없이 부른다.
 * @param {string|null|undefined} linkScreen
 * @param {{navigate: (name: string, params?: object) => void}} [navigation]
 */
export function openLink(linkScreen, navigation) {
  const target = resolveLink(linkScreen);
  if (navigation) navigation.navigate(target.name, target.params);
  else navigate(target.name, target.params);
}

export default openLink;
