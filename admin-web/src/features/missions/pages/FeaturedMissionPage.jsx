// ADM-17 추천 미션
// Menu and route only: the content is not built yet (docs/parts/admin-web.md §7 rule 5).
import { NotImplementedPanel } from '../../../components/NotImplementedPanel.jsx';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { t } from '../../../i18n/index.js';

export default function FeaturedMissionPage() {
  return (
    <>
      <PageHeader title={t('추천 미션')} />
      <NotImplementedPanel />
    </>
  );
}
