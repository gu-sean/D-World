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
      { label: '검수 대기', path: '/verifications' },
      { label: '이의 신청', path: '/verifications/appeals' },
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
      { label: '추천 미션', path: '/missions/featured' },
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
  {
    key: 'billing',
    label: '결제·구독',
    children: [
      { label: '구독', path: '/billing/subscriptions' },
      { label: '결제', path: '/billing/payments' },
      { label: '환불', path: '/billing/refunds' },
      { label: '이용권', path: '/billing/entitlements' },
    ],
  },
  {
    key: 'content',
    label: '운영 콘텐츠',
    children: [
      { label: '공지', path: '/content/notices' },
      { label: '푸시 알림', path: '/content/push' },
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
