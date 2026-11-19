import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import koKR from 'antd/locale/ko_KR';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/ko';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { shouldRetryQuery } from '../api/retryPolicy.js';
import { DEFAULT_STALE_MS } from '../api/staleTime.js';
import { getLang } from '../i18n/index.js';
import { MessageBridge } from '../lib/message.jsx';

// Dates are always displayed in Asia/Seoul (docs/parts/admin-web.md §2).
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Seoul');
dayjs.locale(getLang());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      staleTime: DEFAULT_STALE_MS,
    },
  },
});

// Base antd theme. Type scale: page title 24 / section title 18 / table header 14 bold / body 14.
// Placeholder and secondary text are darker than antd's defaults to keep a readable contrast.
const theme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    colorBgLayout: '#f4f6fa',
    colorTextPlaceholder: '#7b8296',
    colorTextDescription: '#6b7285',
  },
  components: {
    Table: {
      headerBg: '#f7f8fc',
      headerColor: '#2c3345',
      rowHoverBg: '#f2f6ff',
      borderColor: '#e8ebf2',
    },
    Card: { headerFontSize: 16 },
    Typography: { titleMarginBottom: '0.5em' },
    Menu: { itemBorderRadius: 8, itemMarginInline: 8 },
  },
};

/**
 * Global providers: TanStack Query + antd ConfigProvider (antd locale follows the UI language, theme).
 * @param {{children?: import('react').ReactNode}} props
 */
export default function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={getLang() === 'en' ? enUS : koKR} theme={theme}>
        <App>
          <MessageBridge />
          {children}
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
