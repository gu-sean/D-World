import { Empty } from 'antd';

/**
 * Body of the screens that have a menu and a route but no content yet
 * (ADM-17 and ADM-28~31, docs/parts/admin-web.md §7 rule 5).
 * The text is the message of COMMON_NOT_IMPLEMENTED (docs/05 §7).
 */
export function NotImplementedPanel() {
  return <Empty style={{ padding: '96px 0' }} description="준비 중인 기능이에요." />;
}
