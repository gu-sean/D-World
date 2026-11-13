import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal } from 'antd';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { server } from '../../test/setup.js';
import { handlers, resetMockData } from './mocks.js';
import ChallengeFormPage from './pages/ChallengeFormPage.jsx';
import ChallengeListPage from './pages/ChallengeListPage.jsx';
import ChallengeRankingReviewPage from './pages/ChallengeRankingReviewPage.jsx';
import ChallengeSettlementPage from './pages/ChallengeSettlementPage.jsx';

// The api layer reads the base URL when it is first imported, so set it before the imports run.
vi.hoisted(() => {
  import.meta.env.VITE_ADMIN_API_BASE_URL = '/admin/v1';
});

const renderAt = (path, routePath, element) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/challenges" element={<div>목록 이동됨</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => Modal.destroyAll());

beforeEach(() => {
  resetMockData();
  server.use(...handlers);
});

// antd renders slowly in jsdom, so these tests get more time than the 5 s default.
vi.setConfig({ testTimeout: 20000 });

describe('challenge screens', () => {
  it('lists challenges with their status', async () => {
    renderAt('/challenges', '/challenges', <ChallengeListPage />);
    expect(await screen.findByText('14일 푸시업 챌린지')).toBeInTheDocument();
    expect(screen.getByText('주말 러닝 챌린지')).toBeInTheDocument();
    expect(screen.getAllByText('검수 대기').length).toBeGreaterThan(0);
  });

  it('shows the ranking and blocks disqualifying without a reason', async () => {
    const user = userEvent.setup();
    renderAt(
      '/challenges/c4000001/rankings',
      '/challenges/:challengeId/rankings',
      <ChallengeRankingReviewPage />,
    );
    expect(await screen.findByText('민수')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '검토' })[0]);
    await user.click(await screen.findByRole('button', { name: '실격 처리' }));
    // The drawer is also a dialog, so look for the modal by its confirm button.
    await user.click(await screen.findByRole('button', { name: '확인' }));
    expect(await screen.findByText('사유를 입력해 주세요.')).toBeInTheDocument();
  });

  it('creates a settlement draft and shows its entries', async () => {
    const user = userEvent.setup();
    renderAt(
      '/challenges/c4000001/settlement',
      '/challenges/:challengeId/settlement',
      <ChallengeSettlementPage />,
    );
    await user.click(await screen.findByRole('button', { name: '정산 초안 만들기' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '정기 정산');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.getByText('초안')).toBeInTheDocument());
    expect(screen.getAllByText('완주').length).toBeGreaterThan(0);
  });

  it('shows the CHALLENGE_NOT_ENDED text when the draft cannot be made yet', async () => {
    server.use(
      mswHttp.post('/admin/v1/challenges/:id/settlement-runs', () =>
        HttpResponse.json(
          { error: { code: 'CHALLENGE_NOT_ENDED', message: '아직 정산할 수 없어요.' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt(
      '/challenges/c4000001/settlement',
      '/challenges/:challengeId/settlement',
      <ChallengeSettlementPage />,
    );
    await user.click(await screen.findByRole('button', { name: '정산 초안 만들기' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '정기 정산');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('아직 정산할 수 없어요.')).toBeInTheDocument();
  });

  it('validates the form before the confirm modal opens', async () => {
    const user = userEvent.setup();
    renderAt('/challenges/new', '/challenges/new', <ChallengeFormPage />);
    await user.click(await screen.findByRole('button', { name: '저장' }));
    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
