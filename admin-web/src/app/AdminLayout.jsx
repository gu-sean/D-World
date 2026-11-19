import { useEffect, useState } from 'react';
import {
  AlertOutlined,
  AuditOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DownOutlined,
  GiftOutlined,
  LogoutOutlined,
  MenuOutlined,
  NotificationOutlined,
  ScheduleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Layout,
  Menu,
  Space,
  theme,
  Typography,
} from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { getAdmin } from '../api/session.js';
import { useLogout, useMe } from '../features/auth/queries.js';
import { findGroupKey, findLabel, findSelectedPath, MENU } from './menu.js';
import { useDashboardSummary } from '../features/dashboard/queries.js';
import { lastDays } from '../features/dashboard/period.js';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import { OfflineBanner } from '../components/OfflineBanner.jsx';
import { useIdleLogout } from './useIdleLogout.js';
import { t } from '../i18n/index.js';

const { Header, Sider, Content } = Layout;

// Menu icons by group / leaf key, and which waiting-work queues add up to the count badge of an item.
const ICONS = {
  dashboard: <DashboardOutlined />,
  users: <TeamOutlined />,
  verifications: <SafetyCertificateOutlined />,
  support: <AlertOutlined />,
  missions: <ScheduleOutlined />,
  challenges: <TrophyOutlined />,
  rewards: <GiftOutlined />,
  billing: <CreditCardOutlined />,
  content: <NotificationOutlined />,
  access: <AuditOutlined />,
};
const GROUP_QUEUES = {
  users: ['withdrawal'],
  verifications: ['verification', 'appeal'],
  support: ['report', 'inquiry'],
};
const LEAF_QUEUES = {
  '/users/withdrawals': ['withdrawal'],
  '/verifications/appeals': ['verification', 'appeal'],
  '/support/inquiries': ['inquiry'],
  '/support/abuse': ['report'],
};

const withBadge = (label, count) =>
  count > 0 ? (
    <Flex justify="space-between" align="center" gap={8}>
      <span>{label}</span>
      <Badge count={count} size="small" overflowCount={99} />
    </Flex>
  ) : (
    label
  );

/** antd Menu items with icons and a count badge where work is waiting. */
function buildMenuItems(countOf) {
  return MENU.map((entry) =>
    entry.children
      ? {
          key: entry.key,
          icon: ICONS[entry.key],
          label: withBadge(entry.label, countOf(GROUP_QUEUES[entry.key])),
          children: entry.children.map((child) => ({
            key: child.path,
            label: withBadge(child.label, countOf(LEAF_QUEUES[child.path])),
          })),
        }
      : { key: entry.path, icon: ICONS[entry.key], label: entry.label },
  );
}

const NARROW_QUERY = '(max-width: 991px)'; // same width as antd's `lg` breakpoint

/** True while the window is narrower than 992px (follows resizes). */
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = (event) => setNarrow(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/** Sidebar (menu.js), header with the admin name and logout, and the page (Outlet). */
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { data: me } = useMe();
  const logout = useLogout();
  const narrow = useNarrow();
  // Waiting-work counts for the menu badges; asked again every minute.
  const summary = useDashboardSummary(lastDays(1), { refetchInterval: 60_000 });
  const queueCounts = Object.fromEntries(
    (summary.data?.queues ?? []).map((queue) => [queue.type, queue.count]),
  );
  const countOf = (types = []) => types.reduce((sum, type) => sum + (queueCounts[type] ?? 0), 0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedPath = findSelectedPath(location.pathname);

  // Browser tab title: "D-World 관리자 · 회원 목록" (detail pages use their menu's name)
  const pageLabel = selectedPath ? findLabel(selectedPath) : null;
  useEffect(() => {
    document.title = pageLabel ? `${t('D-World 관리자')} · ${pageLabel}` : t('D-World 관리자');
  }, [pageLabel]);
  const [openKeys, setOpenKeys] = useState(() => {
    const groupKey = findGroupKey(selectedPath);
    return groupKey ? [groupKey] : [];
  });
  const loginId = me?.loginId ?? getAdmin()?.loginId;

  // Safety: leave a screen that was forgotten open (shared computer) after 30 minutes of no activity.
  useIdleLogout({
    onIdle: () =>
      logout.mutate(undefined, {
        onSettled: () => navigate('/login?reason=idle', { replace: true }),
      }),
  });

  const handleLogout = () => {
    // The hook clears the session and the query cache first, then we leave.
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  };

  const menu = (
    <Menu
      mode="inline"
      items={buildMenuItems(countOf)}
      selectedKeys={selectedPath ? [selectedPath] : []}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
      style={{ borderInlineEnd: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Wide: fixed sidebar. Narrow: the same menu in a drawer opened from the header button. */}
      {narrow ? (
        <Drawer
          placement="left"
          size={240}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('D-World 관리자')}
          styles={{ body: { padding: 0 } }}
        >
          {menu}
        </Drawer>
      ) : (
        <Sider
          width={220}
          theme="light"
          style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}
        >
          <Typography.Title level={4} style={{ margin: 16 }}>
            {t('D-World 관리자')}
          </Typography.Title>
          {menu}
        </Sider>
      )}
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: narrow ? 'space-between' : 'flex-end',
            padding: narrow ? '0 12px' : '0 24px',
          }}
        >
          {narrow && (
            <Button
              type="text"
              aria-label={t('메뉴')}
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          )}
          <Space>
            <LanguageSwitch />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: t('로그아웃'),
                    disabled: logout.isPending,
                    onClick: handleLogout,
                  },
                ],
              }}
            >
              <Button type="text" icon={<UserOutlined />} aria-label={t('계정 메뉴')}>
                {loginId} <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: narrow ? 12 : 24, minWidth: 0 }}>
          <OfflineBanner />
          {/* one broken page does not take the menu down; moving to another page tries again */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
