import { lazy, Suspense } from 'react';
import { Empty, Result, Spin } from 'antd';
import { createBrowserRouter, Navigate } from 'react-router';
import AdminLayout from './AdminLayout.jsx';
import RequireAuth from './RequireAuth.jsx';

// Every page is the default export of src/features/<feature>/pages/<PageName>.jsx.
// A page that does not exist yet shows a placeholder, and starts working as soon as its file
// is created: nobody has to edit this file when a page is added.
const pageModules = import.meta.glob('../features/*/pages/*.jsx');

// Screen table of docs/parts/admin-web.md §4. `page` is '<feature>/<PageName>'.
const ROUTES = [
  { path: '/dashboard', page: 'dashboard/DashboardPage' }, // ADM-01
  { path: '/users', page: 'users/UserListPage' }, // ADM-02
  { path: '/users/:userId', page: 'users/UserDetailPage' }, // ADM-03
  { path: '/users/:userId/actions/new', page: 'users/AccountActionPage' }, // ADM-04
  { path: '/users/withdrawals', page: 'users/WithdrawalListPage' }, // ADM-05
  { path: '/support/inquiries', page: 'support/InquiryListPage' }, // ADM-06
  { path: '/support/inquiries/:ticketId', page: 'support/InquiryDetailPage' }, // ADM-06
  { path: '/support/abuse', page: 'support/AbuseTicketListPage' }, // ADM-11
  { path: '/support/abuse/:ticketId', page: 'support/AbuseTicketDetailPage' }, // ADM-12
  { path: '/verifications', page: 'verifications/VerificationQueuePage' }, // ADM-07
  { path: '/verifications/:recordId', page: 'verifications/VerificationDetailPage' }, // ADM-08
  { path: '/verifications/appeals', page: 'verifications/AppealListPage' }, // ADM-09
  { path: '/verifications/appeals/:appealId', page: 'verifications/AppealReviewPage' }, // ADM-09
  { path: '/verifications/criteria', page: 'verifications/VerificationCriteriaPage' }, // ADM-10
  { path: '/missions/definitions', page: 'missions/MissionDefinitionListPage' }, // ADM-13
  { path: '/missions/definitions/new', page: 'missions/MissionDefinitionFormPage' }, // ADM-14
  { path: '/missions/definitions/:definitionId/edit', page: 'missions/MissionDefinitionFormPage' }, // ADM-14
  { path: '/missions/categories', page: 'missions/CategoryDifficultyPage' }, // ADM-15
  { path: '/missions/reviews', page: 'missions/UserMissionReviewPage' }, // ADM-16
  { path: '/missions/featured', page: 'missions/FeaturedMissionPage' }, // ADM-17
  { path: '/challenges', page: 'challenges/ChallengeListPage' }, // ADM-18
  { path: '/challenges/new', page: 'challenges/ChallengeFormPage' }, // ADM-19
  { path: '/challenges/:challengeId/edit', page: 'challenges/ChallengeFormPage' }, // ADM-19
  { path: '/challenges/:challengeId/settlement', page: 'challenges/ChallengeSettlementPage' }, // ADM-20
  { path: '/challenges/:challengeId/rankings', page: 'challenges/ChallengeRankingReviewPage' }, // ADM-21
  { path: '/rewards/points', page: 'rewards/PointTransactionListPage' }, // ADM-22
  { path: '/rewards/points/adjust', page: 'rewards/PointAdjustmentPage' }, // ADM-23
  { path: '/rewards/point-policies', page: 'rewards/PointPolicyPage' }, // ADM-24
  { path: '/rewards/achievements', page: 'rewards/AchievementPolicyPage' }, // ADM-25
  { path: '/rewards/pets', page: 'rewards/PetPolicyPage' }, // ADM-26
  { path: '/rewards/streak-policies', page: 'rewards/StreakPolicyPage' }, // ADM-27
  { path: '/billing/subscriptions', page: 'billing/BillingPlaceholderPage' }, // ADM-28
  { path: '/billing/payments', page: 'billing/BillingPlaceholderPage' }, // ADM-29
  { path: '/billing/refunds', page: 'billing/BillingPlaceholderPage' }, // ADM-30
  { path: '/billing/entitlements', page: 'billing/BillingPlaceholderPage' }, // ADM-31
  { path: '/content/notices', page: 'content/NoticePage' }, // ADM-32
  { path: '/content/push', page: 'content/PushNotificationPage' }, // ADM-33
  { path: '/content/policies', page: 'content/PolicyDocumentPage' }, // ADM-34
  { path: '/content/messages', page: 'content/RecommendationMessagePage' }, // ADM-35
  { path: '/access/audit-logs', page: 'access/AuditLogPage' }, // ADM-36
];

// Temporary stand-ins until the shared StatePanel exists (AW-04). They are elements, not
// components, because a component defined here would break fast refresh (lint rule
// react-refresh/only-export-components) in a file that exports the router.
const placeholderElement = (
  <Empty style={{ marginTop: 96 }} description="아직 준비되지 않은 화면이에요." />
);
const notFoundElement = <Result status="404" title="찾을 수 없어요." />;

function pageElement(page) {
  const [feature, name] = page.split('/');
  const load = pageModules[`../features/${feature}/pages/${name}.jsx`];
  if (!load) return placeholderElement;
  const Page = lazy(load);
  return (
    <Suspense fallback={<Spin style={{ display: 'block', marginTop: 96 }} />}>
      <Page />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: pageElement('auth/LoginPage') },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          ...ROUTES.map(({ path, page }) => ({ path: path.slice(1), element: pageElement(page) })),
          { path: '*', element: notFoundElement },
        ],
      },
    ],
  },
]);
