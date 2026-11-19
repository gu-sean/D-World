// LOGIN Admin login screen
import { useEffect } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Navigate, useSearchParams } from 'react-router';
import { getAccessToken } from '../../../api/session.js';
import { useLogin } from '../queries.js';
import LanguageSwitch from '../../../components/LanguageSwitch.jsx';
import { t } from '../../../i18n/index.js';

// `next` is where RequireAuth sent the admin from. Only paths inside this site are accepted
// (no "//host" or "/\host"), so a crafted link cannot send the admin to another site.
const isSitePath = (path) => /^\/(?![/\\])/.test(path);
const safeNextPath = (next) =>
  next && isSitePath(next) && !next.startsWith('/login') ? next : '/dashboard';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const login = useLogin();
  const next = safeNextPath(searchParams.get('next'));

  useEffect(() => {
    document.title = `${t('D-World 관리자')} · ${t('로그인')}`;
  }, []);

  // After a successful login the session exists, so this page redirects by itself.
  if (getAccessToken()) return <Navigate to={next} replace />;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Card style={{ width: 360 }}>
        <div style={{ textAlign: 'right', marginBottom: 8 }}>
          <LanguageSwitch />
        </div>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          {t('D-World 관리자')}
        </Typography.Title>
        {searchParams.get('reason') === 'idle' && (
          <Alert
            type="info"
            showIcon
            title={t('오래 사용하지 않아 안전을 위해 로그아웃했어요. 다시 로그인해 주세요.')}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout="vertical" onFinish={(values) => login.mutate(values)}>
          <Form.Item
            label={t('아이디')}
            name="loginId"
            rules={[{ required: true, message: t('아이디를 입력해 주세요.') }]}
          >
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item
            label={t('비밀번호')}
            name="password"
            rules={[{ required: true, message: t('비밀번호를 입력해 주세요.') }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {login.isError && (
            <Typography.Paragraph type="danger">{login.error.message}</Typography.Paragraph>
          )}
          <Button type="primary" htmlType="submit" block loading={login.isPending}>
            {t('로그인')}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
