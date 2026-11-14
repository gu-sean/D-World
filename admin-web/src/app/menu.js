// Sidebar menu, in the order of docs/parts/admin-web.md §6. Labels are the Korean UI texts.
// A group has `children`; a leaf has a `path`. A leaf path is also its antd Menu key.
export const MENU = [
  { key: 'dashboard', label: '대시보드', path: '/dashboard' },
  {
    key: 'users',
    label: '회원 관리',
    children: [
      { label: '회원 목록', path: '/users' },
      { label: '탈퇴 요청', path: '/users/withdrawals' },
    ],
  },
  {
    key: 'verifications',
    label: '인증 검수',
    children: [
      // 관리자 판정은 처리 대기 한 곳(이의 신청 + AI 판정 보류), 인증 기록은 읽기 전용 이력
      { label: '처리 대기', path: '/verifications/appeals' },
      { label: '인증 기록', path: '/verifications' },
      { label: '판정 기준', path: '/verifications/criteria' },
    ],
  },
  {
    key: 'support',
    label: '신고 관리',
    children: [
      { label: '문의', path: '/support/inquiries' },
      { label: '신고', path: '/support/abuse' },
    ],
  },
  {
    key: 'missions',
    label: '미션 관리',
    children: [
      { label: '미션 정의', path: '/missions/definitions' },
      { label: '분야·난이도', path: '/missions/categories' },
      { label: '사용자 미션 검수', path: '/missions/reviews' },
    ],
  },
  { key: 'challenges', label: '챌린지', path: '/challenges' },
  {
    key: 'rewards',
    label: '보상 관리',
    children: [
      { label: '포인트 내역', path: '/rewards/points' },
      { label: '포인트 조정', path: '/rewards/points/adjust' },
      { label: '포인트 정책', path: '/rewards/point-policies' },
      { label: '업적', path: '/rewards/achievements' },
      { label: '펫', path: '/rewards/pets' },
      { label: '연속 일수 정책', path: '/rewards/streak-policies' },
    ],
  },
  // 결제·구독은 아직 껍데기(M110 501)라 한 화면으로 모았다. 구독·결제·환불·이용권 주소는 그대로 열린다.
  { key: 'billing', label: '결제·구독', path: '/billing/subscriptions' },
  {
    key: 'content',
    label: '운영 콘텐츠',
    children: [
      // 공지와 푸시 알림은 같은 공지 데이터라 한 메뉴로 합쳤다 (목록의 푸시 필터로 구분)
      { label: '공지·푸시', path: '/content/notices' },
      { label: '약관·정책', path: '/content/policies' },
      { label: '추천 문구', path: '/content/messages' },
    ],
  },
  {
    key: 'access',
    label: '접근 관리',
    children: [{ label: '감사 로그', path: '/access/audit-logs' }],
  },
];

const leaves = MENU.flatMap((entry) => entry.children ?? [entry]);

/** antd Menu `items`: leaves use their path as key, groups use their own key. */
export const menuItems = MENU.map((entry) =>
  entry.children
    ? {
        key: entry.key,
        label: entry.label,
        children: entry.children.map((child) => ({ key: child.path, label: child.label })),
      }
    : { key: entry.path, label: entry.label },
);

/**
 * The leaf that should be highlighted for a URL path: the longest leaf path that is the
 * path itself or one of its parents (/users/withdrawals -> '/users/withdrawals',
 * /users/abc -> '/users').
 * @param {string} pathname
 * @returns {string|null}
 */
export function findSelectedPath(pathname) {
  let best = null;
  for (const { path } of leaves) {
    const matches = pathname === path || pathname.startsWith(`${path}/`);
    if (matches && (best === null || path.length > best.length)) best = path;
  }
  return best;
}

/**
 * Key of the group that contains a leaf path (to keep it open), or null.
 * @param {string|null} path
 * @returns {string|null}
 */
export function findGroupKey(path) {
  const group = MENU.find((entry) => entry.children?.some((child) => child.path === path));
  return group?.key ?? null;
}
