import { useLocation } from 'react-router';
import { NotImplementedPanel } from '../../../components/NotImplementedPanel.jsx';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';

// The four routes share this page (docs/parts/admin-web.md §3: ADM-28~31).
const TITLES = {
  '/billing/subscriptions': t('구독'),
  '/billing/payments': t('결제'),
  '/billing/refunds': t('환불'),
  '/billing/entitlements': t('이용권'),
};

/** ADM-28~31 구독·결제·환불·이용권: the menu and route exist, the content is not built yet (M110 answers 501). */
export default function BillingPlaceholderPage() {
  const { pathname } = useLocation();
  return (
    <>
      <PageHeader title={TITLES[pathname] ?? t('결제·구독')} />
      <NotImplementedPanel />
    </>
  );
}
