import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp } from 'msw';
import { BASE, errorResponse } from '../../mocks/helpers.js';
import { renderWithProviders } from '../../test/renderWithProviders.js';
import { server } from '../../test/setup.js';
import { handlers } from './mocks.js';
import AuditLogPage from './pages/AuditLogPage.jsx';

// Records the query parameters of M101 and lets the real mock answer.
function recordListQueries() {
  const seen = [];
  server.use(
    mswHttp.get(`${BASE}/audit-logs`, ({ request }) => {
      seen.push(Object.fromEntries(new URL(request.url).searchParams));
    }),
  );
  return seen;
}

const rowOf = (text) => within(screen.getByRole('table')).getByText(text).closest('tr');

describe('AuditLogPage', () => {
  test('lists the logs, newest first, and asks M101 for sort=recordedAt,desc', async () => {
    server.use(...handlers);
    const seen = recordListQueries();
    renderWithProviders(<AuditLogPage />, { url: '/access/audit-logs' });

    expect(await screen.findByText('총 45건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({ sort: 'recordedAt,desc', page: '1', size: '20' });
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(21); // the header and 20 logs
    expect(within(rows[1]).getByText('account_action.lift')).toBeInTheDocument(); // the newest
    expect(within(rows[1]).getByText('dev_admin')).toBeInTheDocument();
    expect(within(rows[1]).getByText('성공')).toBeInTheDocument();
    expect(within(rows[1]).getByText('오해로 인한 제한이라 해제해요')).toBeInTheDocument();
  });

  test('links the target user to the detail of the user', async () => {
    server.use(...handlers);
    renderWithProviders(<AuditLogPage />, { url: '/access/audit-logs' });
    await screen.findByText('총 45건');

    expect(within(rowOf('account_action.lift')).getByRole('link')).toHaveAttribute(
      'href',
      '/users/a4000003',
    );
  });

  test('asks M101 for the filters of the URL and shows only what matches', async () => {
    server.use(...handlers);
    const seen = recordListQueries();
    renderWithProviders(<AuditLogPage />, {
      url: '/access/audit-logs?action=verification.&adminId=dev_admin',
    });

    expect(await screen.findByText('총 7건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({ action: 'verification.', adminId: 'dev_admin' });
    expect(screen.getAllByText('verification.decide')).toHaveLength(7);
  });

  test('shows a failed change with its result', async () => {
    server.use(...handlers);
    renderWithProviders(<AuditLogPage />, {
      url: '/access/audit-logs?result=failure&adminId=other_admin',
    });

    expect(await screen.findByText('총 1건')).toBeInTheDocument();
    expect(within(rowOf('notice.publish')).getByText('실패')).toBeInTheDocument();
  });

  test('asks M101 for the period of the URL', async () => {
    server.use(...handlers);
    const seen = recordListQueries();
    renderWithProviders(<AuditLogPage />, {
      url: '/access/audit-logs?from=2026-10-20&to=2026-10-20',
    });

    expect(await screen.findByText('총 10건')).toBeInTheDocument();
    expect(seen.at(-1)).toMatchObject({ from: '2026-10-20', to: '2026-10-20' });
  });

  test('shows the values before and after a change', async () => {
    const user = userEvent.setup();
    server.use(...handlers);
    renderWithProviders(<AuditLogPage />, { url: '/access/audit-logs' });
    await screen.findByText('총 45건');

    await user.click(
      within(rowOf('account_action.lift')).getByRole('button', { name: '변경 내용' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('변경 전')).toBeInTheDocument();
    expect(within(dialog).getByText('변경 후')).toBeInTheDocument();
    expect(within(dialog).getByText(/"liftedAt": null/)).toBeInTheDocument();
    expect(within(dialog).getByText(/"liftedAt": "2026-10-20T00:00:00.000Z"/)).toBeInTheDocument();
    expect(within(dialog).getByText('account_action.lift')).toBeInTheDocument();
    expect(within(dialog).getByText('오해로 인한 제한이라 해제해요')).toBeInTheDocument();
  });

  test('says that a log without values has none', async () => {
    const user = userEvent.setup();
    server.use(...handlers);
    renderWithProviders(<AuditLogPage />, { url: '/access/audit-logs' });
    await screen.findByText('총 45건');

    await user.click(within(rowOf('ticket.assign')).getByRole('button', { name: '변경 내용' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('없음')).toHaveLength(2);
  });

  test('shows the forbidden state for a 403', async () => {
    server.use(
      mswHttp.get(`${BASE}/audit-logs`, () =>
        errorResponse(403, 'COMMON_FORBIDDEN', '서버가 보낸 문구'),
      ),
    );
    renderWithProviders(<AuditLogPage />, { url: '/access/audit-logs' });

    expect(await screen.findByText('권한이 없어요.')).toBeInTheDocument();
  });
});
