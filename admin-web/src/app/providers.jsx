import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import koKR from 'antd/locale/ko_KR';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/ko';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getLang } from '../i18n/index.js';

// Dates are always displayed in Asia/Seoul (docs/parts/admin-web.md §2).
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Seoul');
dayjs.locale(getLang());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

// Base antd theme. Brand colors can be adjusted here once the UI/UX design is confirmed.
const theme = { token: { colorPrimary: '#1677ff' } };

/**
 * Global providers: TanStack Query + antd ConfigProvider (antd locale follows the UI language, theme).
 * @param {{children?: import('react').ReactNode}} props
 */
export default function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={getLang() === 'en' ? enUS : koKR} theme={theme}>
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  );
}
