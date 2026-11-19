import { useEffect, useState } from 'react';
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Button, Drawer, Layout, Menu, Space, theme, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { getAdmin } from '../api/session.js';
import { useLogout, useMe } from '../features/auth/queries.js';
import { findGroupKey, findSelectedPath, menuItems } from './menu.js';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import { t } from '../i18n/index.js';

const { Header, Sider, Content } = Layout;

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedPath = findSelectedPath(location.pathname);
  const [openKeys, setOpenKeys] = useState(() => {
    const groupKey = findGroupKey(selectedPath);
    return groupKey ? [groupKey] : [];
  });
  const loginId = me?.loginId ?? getAdmin()?.loginId;

  const handleLogout = () => {
    // The hook clears the session and the query cache first, then we leave.
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  };

  const menu = (
    <Menu
      mode="inline"
      items={menuItems}
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
        <Sider width={220} theme="light">
          <Typography.Title level={4} style={{ margin: 16 }}>
            {t('D-World 관리자')}
          </Typography.Title>
          {menu}
        </Sider>
      )}
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
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
            <Typography.Text>{loginId}</Typography.Text>
            <Button icon={<LogoutOutlined />} loading={logout.isPending} onClick={handleLogout}>
              {t('로그아웃')}
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: narrow ? 12 : 24, minWidth: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
