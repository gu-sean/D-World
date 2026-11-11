import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { http as mswHttp, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { server } from '../../test/setup.js';
import { handlers } from './mocks.js';
import AppealListPage from './pages/AppealListPage.jsx';
import AppealReviewPage from './pages/AppealReviewPage.jsx';
import VerificationCriteriaPage from './pages/VerificationCriteriaPage.jsx';
import VerificationQueuePage from './pages/VerificationQueuePage.jsx';

// httpClient.js reads the base URL when it is loaded, so set it before the pages are imported.
vi.hoisted(() => {
  import.meta.env.VITE_ADMIN_API_BASE_URL = '/admin/v1';
});

const renderAt = (path) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verifications" element={<VerificationQueuePage />} />
          <Route path="/verifications/appeals" element={<AppealListPage />} />
          <Route path="/verifications/appeals/:appealId" element={<AppealReviewPage />} />
          <Route path="/verifications/criteria" element={<VerificationCriteriaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => server.use(...handlers));

describe('verifications', () => {
  it('shows the queue and the number of decisions made today', async () => {
    renderAt('/verifications');
    expect(await screen.findByText('가상 미션 1')).toBeInTheDocument();
    expect(screen.getByText('오늘 처리한 판정')).toBeInTheDocument();
    expect(screen.getAllByText('검수 대기').length).toBeGreaterThan(0);
  });

  it('shows an empty message when nothing is waiting', async () => {
    server.use(
      mswHttp.get('/admin/v1/verifications', () =>
        HttpResponse.json({ items: [], page: 1, size: 20, totalCount: 0 }),
      ),
    );
    renderAt('/verifications');
    expect(await screen.findByText('검수할 인증이 없습니다.')).toBeInTheDocument();
  });

  it('lists open appeals', async () => {
    renderAt('/verifications/appeals');
    expect(
      await screen.findByText('운동 중인 사진이 맞아요. 다시 확인해 주세요.'),
    ).toBeInTheDocument();
  });

  it(
    'resolves an appeal with an Idempotency-Key after the confirm dialog',
    { timeout: 20000 },
    async () => {
      let seen;
      server.use(
        mswHttp.post('/admin/v1/appeals/:id/resolution', async ({ request }) => {
          seen = {
            key: request.headers.get('idempotency-key'),
            body: await request.json(),
          };
          return HttpResponse.json({ status: 'accepted' });
        }),
      );
      const user = userEvent.setup();
      renderAt('/verifications/appeals/e0000000-0000-4000-8000-000000000001');
      await user.click(await screen.findByLabelText('이의 인정'));
      await user.type(screen.getByLabelText('사유'), '증거가 충분합니다');
      await user.click(screen.getByRole('button', { name: '처리 저장' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: '이의 인정' }));
      await waitFor(() => expect(seen).toBeDefined());
      expect(seen.body).toEqual({ decision: 'approved', reason: '증거가 충분합니다' });
      expect(seen.key).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('lists the criteria versions', async () => {
    renderAt('/verifications/criteria');
    expect(await screen.findByText('{"minConfidence":0.8}')).toBeInTheDocument();
  });
});
