import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { server } from '../../test/setup.js';

let handlers;
let ListPage;
let ReviewPage;
let FormPage;
let CatalogPage;
let FeaturedPage;

beforeAll(async () => {
  // httpClient.js reads the base URL when it is loaded, so stub it before importing.
  vi.stubEnv('VITE_ADMIN_API_BASE_URL', '/admin/v1');
  ({ handlers } = await import('./mocks.js'));
  ListPage = (await import('./pages/MissionDefinitionListPage.jsx')).default;
  ReviewPage = (await import('./pages/UserMissionReviewPage.jsx')).default;
  FormPage = (await import('./pages/MissionDefinitionFormPage.jsx')).default;
  CatalogPage = (await import('./pages/CategoryDifficultyPage.jsx')).default;
  FeaturedPage = (await import('./pages/FeaturedMissionPage.jsx')).default;
});

afterAll(() => vi.unstubAllEnvs());
beforeEach(() => server.use(...handlers));

function renderAt(path, routePath, element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/missions/definitions" element={<div>목록으로 이동</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('missions', () => {
  it('lists mission definitions from the API', async () => {
    renderAt('/missions/definitions', '/missions/definitions', <ListPage />);
    expect(await screen.findByText('푸시업 20회')).toBeInTheDocument();
    expect(screen.getByText('스쿼트 30회')).toBeInTheDocument();
  });

  it('shows the server error text of a failed review', async () => {
    const { http: mswHttp, HttpResponse } = await import('msw');
    server.use(
      mswHttp.post('/admin/v1/mission-definitions/:id/reviews', () =>
        HttpResponse.json(
          { error: { code: 'COMMON_INTERNAL', message: '잠시 후 다시 시도해 주세요.' } },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt('/missions/reviews', '/missions/reviews', <ReviewPage />);
    const row = (await screen.findByText('사용자 달리기')).closest('tr');
    await user.click(within(row).getByRole('button', { name: /반려/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '기준에 맞지 않아요');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
  }, 20000);

  it('blocks a review without a reason, then approves with one', async () => {
    const user = userEvent.setup();
    renderAt('/missions/reviews', '/missions/reviews', <ReviewPage />);
    const row = (await screen.findByText('사용자 달리기')).closest('tr');
    await user.click(within(row).getByRole('button', { name: /승인/ }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('사유를 입력해 주세요.')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox'), '기준에 맞아요');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.queryByText('사용자 달리기')).not.toBeInTheDocument());
  }, 20000);

  it('asks for the required fields of the form', async () => {
    const user = userEvent.setup();
    renderAt('/missions/definitions/new', '/missions/definitions/new', <FormPage />);
    await user.type(await screen.findByLabelText('제목'), '테스트');
    await user.click(screen.getByRole('button', { name: '등록' }));
    expect((await screen.findAllByText(/선택해 주세요/)).length).toBeGreaterThan(0);
  });

  it('shows categories', async () => {
    renderAt('/missions/categories', '/missions/categories', <CatalogPage />);
    expect(await screen.findByText('운동')).toBeInTheDocument();
  });

  it('shows CATALOG_IN_USE when a category in use is turned off', async () => {
    const user = userEvent.setup();
    renderAt('/missions/categories', '/missions/categories', <CatalogPage />);
    const row = (await screen.findByText('운동')).closest('tr');
    await user.click(within(row).getByRole('switch'));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '더 이상 쓰지 않아요');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));
    expect(await within(dialog).findByText('사용 중이라 끌 수 없어요.')).toBeInTheDocument();
  }, 20000);

  it('shows the not-implemented panel for featured missions (ADM-17)', () => {
    renderAt('/missions/featured', '/missions/featured', <FeaturedPage />);
    expect(screen.getByText('준비 중인 기능이에요.')).toBeInTheDocument();
  });
});
