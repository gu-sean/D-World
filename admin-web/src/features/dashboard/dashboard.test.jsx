import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp, HttpResponse } from 'msw';
import { server } from '../../test/setup.js';
import { renderWithProviders } from '../../test/renderWithProviders.js';
import DashboardPage from './pages/DashboardPage.jsx';
import { countDays, lastDays, resolvePeriod, todayInSeoul } from './period.js';

const SUMMARY_URL = '/admin/v1/dashboard/summary';

// A M05 handler that records the requests. The numbers depend on the length of the period.
function mockSummary() {
  const seen = [];
  server.use(
    mswHttp.get(SUMMARY_URL, ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      seen.push({ from, to });
      const days = countDays(from, to);
      return HttpResponse.json({
        from,
        to,
        activeUserCount: days * 10,
        missionCount: days * 20,
        pendingVerificationCount: 7,
        openReportCount: 3,
        queues: [
          { type: 'verification', count: 7, oldestAt: '2026-11-10T01:20:00.000Z' },
          { type: 'withdrawal', count: 0, oldestAt: null },
        ],
        aggregatedAt: '2026-11-11T03:00:00.000Z',
      });
    }),
  );
  return seen;
}

// Waits until the card of `key` shows `text`. The card appears only after M05 answered, and its
// number is replaced when the period changes, so it is looked up again on every try.
const expectStat = (key, text) =>
  waitFor(() =>
    expect(within(screen.getByTestId(`stat-${key}`)).getByText(text)).toBeInTheDocument(),
  );

describe('DashboardPage', () => {
  test('asks for the period of the URL and shows the numbers and the queues', async () => {
    const seen = mockSummary();
    renderWithProviders(<DashboardPage />, { url: '/dashboard?from=2026-11-01&to=2026-11-03' });

    await expectStat('activeUserCount', '30');
    await expectStat('missionCount', '60');
    await expectStat('pendingVerificationCount', '7');
    await expectStat('openReportCount', '3');
    expect(seen).toEqual([{ from: '2026-11-01', to: '2026-11-03' }]);

    expect(screen.getByText('인증 검수')).toBeInTheDocument();
    expect(screen.getByText('탈퇴 요청')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '바로가기' })[0]).toHaveAttribute(
      'href',
      '/verifications',
    );
  });

  test('asks for today..today when the URL has no period', async () => {
    const seen = mockSummary();
    renderWithProviders(<DashboardPage />, { url: '/dashboard' });

    await expectStat('activeUserCount', '10');
    expect(seen).toEqual([{ from: todayInSeoul(), to: todayInSeoul() }]);
  });

  test('changing the period asks again and shows the new numbers', async () => {
    const user = userEvent.setup();
    const seen = mockSummary();
    renderWithProviders(<DashboardPage />, { url: '/dashboard' });
    await expectStat('activeUserCount', '10');

    await user.click(screen.getByRole('button', { name: '최근 7일' }));

    await expectStat('activeUserCount', '70');
    expect(seen.at(-1)).toEqual(lastDays(7));
    expect(screen.getByTestId('location')).toHaveTextContent(`from=${lastDays(7).from}`);
  });

  test('a period longer than 31 days is not asked for', async () => {
    const seen = mockSummary();
    renderWithProviders(<DashboardPage />, { url: '/dashboard?from=2026-10-01&to=2026-11-11' });

    expect(await screen.findByText('기간은 최대 31일까지 선택할 수 있어요.')).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  test('shows the forbidden state for a 403', async () => {
    server.use(
      mswHttp.get(SUMMARY_URL, () =>
        HttpResponse.json(
          { error: { code: 'COMMON_FORBIDDEN', message: '권한이 없어요.', details: null } },
          { status: 403 },
        ),
      ),
    );
    renderWithProviders(<DashboardPage />, { url: '/dashboard' });

    expect(await screen.findByText('권한이 없어요.')).toBeInTheDocument();
  });

  test('shows the error message with a retry button for a server error', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      mswHttp.get(SUMMARY_URL, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'COMMON_INTERNAL', message: '서버 문구 그대로', details: null } },
          { status: 500 },
        );
      }),
    );
    renderWithProviders(<DashboardPage />, { url: '/dashboard' });

    expect(await screen.findByText('서버 문구 그대로')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(calls).toBe(2));
  });
});

describe('period', () => {
  test('uses today..today by default and one date for both ends', () => {
    const today = todayInSeoul();
    expect(resolvePeriod({})).toEqual({ from: today, to: today, error: null });
    expect(resolvePeriod({ from: '2026-11-05' })).toEqual({
      from: '2026-11-05',
      to: '2026-11-05',
      error: null,
    });
  });

  test('accepts 31 days, refuses 32 days and a reversed period', () => {
    expect(resolvePeriod({ from: '2026-10-12', to: '2026-11-11' }).error).toBeNull(); // 31 days
    expect(resolvePeriod({ from: '2026-10-11', to: '2026-11-11' }).error).toBe('tooLong'); // 32
    expect(resolvePeriod({ from: '2026-11-11', to: '2026-11-10' }).error).toBe('reversed');
  });

  test('lastDays(7) is 7 days ending today', () => {
    const { from, to } = lastDays(7);
    expect(to).toBe(todayInSeoul());
    expect(countDays(from, to)).toBe(7);
  });
});
