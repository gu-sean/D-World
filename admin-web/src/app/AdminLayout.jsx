import { useState } from 'react';
import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Space, theme, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { getAdmin } from '../api/session.js';
import { useLogout, useMe } from '../features/auth/queries.js';
import { findGroupKey, findSelectedPath, menuItems } from './menu.js';

const { Header, Sider, Content } = Layout;

/** Sidebar (menu.js), header with the admin name and logout, and the page (Outlet). */
export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { data: me } = useMe();
  const logout = useLogout();

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light">
        <Typography.Title level={4} style={{ margin: 16 }}>
          D-World 관리자
        </Typography.Title>
        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={selectedPath ? [selectedPath] : []}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
          }}
        >
          <Space>
            <Typography.Text>{loginId}</Typography.Text>
            <Button icon={<LogoutOutlined />} loading={logout.isPending} onClick={handleLogout}>
              로그아웃
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
