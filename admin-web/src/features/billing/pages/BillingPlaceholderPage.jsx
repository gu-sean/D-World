import { Typography } from 'antd';
import { useLocation } from 'react-router';
import { NotImplementedPanel } from '../../../components/NotImplementedPanel.jsx';

// The four routes share this page (docs/parts/admin-web.md §3: ADM-28~31).
const TITLES = {
  '/billing/subscriptions': '구독',
  '/billing/payments': '결제',
  '/billing/refunds': '환불',
  '/billing/entitlements': '이용권',
};

/** ADM-28~31 구독·결제·환불·이용권: the menu and route exist, the content is not built yet (M110 answers 501). */
export default function BillingPlaceholderPage() {
  const { pathname } = useLocation();
  return (
    <>
      <Typography.Title level={3}>{TITLES[pathname] ?? '결제·구독'}</Typography.Title>
      <NotImplementedPanel />
    </>
  );
}
