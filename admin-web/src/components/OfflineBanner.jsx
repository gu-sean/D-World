import { useSyncExternalStore } from 'react';
import { Alert } from 'antd';
import { t } from '../i18n/index.js';

const subscribe = (notify) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};
const getOnline = () => navigator.onLine;

/** Shown while the browser has no network. Data is asked for again by itself when the network is back. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getOnline, () => true);
  if (online) return null;
  return (
    <Alert
      banner
      type="warning"
      role="status"
      title={t('인터넷에 연결되어 있지 않아요. 연결되면 자동으로 다시 불러와요.')}
      style={{ marginBottom: 16 }}
    />
  );
}
