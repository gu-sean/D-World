import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { setOnAuthFailure } from '../api/httpClient.js';
import { getAccessToken, refresh } from '../api/session.js';

/**
 * Guards every page except /login. After a page reload the access token is gone (it lives in
 * memory only), so the first thing to do is M02 refresh with the cookie: if it works the admin
 * stays logged in, if not they go to /login (docs/parts/admin-web.md §5, point 3).
 */
export default function RequireAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(getAccessToken() ? 'authenticated' : 'checking');

  // When the session cannot be renewed later, move with the router instead of a full reload.
  useEffect(() => {
    setOnAuthFailure((loginUrl) => {
      // nothing of this admin's data stays in memory once the session is over
      queryClient.clear();
      navigate(loginUrl, { replace: true });
    });
    return () => setOnAuthFailure();
  }, [navigate, queryClient]);

  useEffect(() => {
    if (status !== 'checking') return undefined;
    let cancelled = false;
    refresh().then(
      () => {
        if (!cancelled) setStatus('authenticated');
      },
      () => {
        if (!cancelled) setStatus('unauthenticated');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'checking') {
    return <Spin size="large" style={{ display: 'block', marginTop: 160 }} />;
  }
  if (status === 'unauthenticated') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
