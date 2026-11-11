// LOGIN Admin login screen
import { Button, Card, Form, Input, Typography } from 'antd';
import { Navigate, useSearchParams } from 'react-router';
import { getAccessToken } from '../../../api/session.js';
import { useLogin } from '../queries.js';

// `next` is where RequireAuth sent the admin from. Only paths inside this site are accepted
// (no "//host" or "/\host"), so a crafted link cannot send the admin to another site.
const isSitePath = (path) => /^\/(?![/\\])/.test(path);
const safeNextPath = (next) =>
  next && isSitePath(next) && !next.startsWith('/login') ? next : '/dashboard';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const login = useLogin();
  const next = safeNextPath(searchParams.get('next'));

  // After a successful login the session exists, so this page redirects by itself.
  if (getAccessToken()) return <Navigate to={next} replace />;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          D-World 관리자
        </Typography.Title>
        <Form layout="vertical" onFinish={(values) => login.mutate(values)}>
          <Form.Item
            label="아이디"
            name="loginId"
            rules={[{ required: true, message: '아이디를 입력해 주세요.' }]}
          >
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item
            label="비밀번호"
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해 주세요.' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {login.isError && (
            <Typography.Paragraph type="danger">{login.error.message}</Typography.Paragraph>
          )}
          <Button type="primary" htmlType="submit" block loading={login.isPending}>
            로그인
          </Button>
        </Form>
      </Card>
    </div>
  );
}
