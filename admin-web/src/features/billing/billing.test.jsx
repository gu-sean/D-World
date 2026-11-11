import { screen } from '@testing-library/react';
import { http } from '../../api/httpClient.js';
import { renderWithProviders } from '../../test/renderWithProviders.js';
import { server } from '../../test/setup.js';
import { handlers } from './mocks.js';
import BillingPlaceholderPage from './pages/BillingPlaceholderPage.jsx';

describe('BillingPlaceholderPage', () => {
  test.each([
    ['/billing/subscriptions', '구독'],
    ['/billing/payments', '결제'],
    ['/billing/refunds', '환불'],
    ['/billing/entitlements', '이용권'],
  ])('%s shows its title and the "not ready" message', (url, title) => {
    renderWithProviders(<BillingPlaceholderPage />, { url });

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('준비 중인 기능이에요.')).toBeInTheDocument();
  });
});

describe('M110 mock', () => {
  test.each([
    ['get', '/subscriptions'],
    ['get', '/payments'],
    ['post', '/payments/p1/refunds'],
    ['post', '/users/u1/entitlements/restore'],
  ])('%s %s answers 501 COMMON_NOT_IMPLEMENTED', async (method, path) => {
    server.use(...handlers);

    await expect(http[method](path)).rejects.toMatchObject({
      status: 501,
      code: 'COMMON_NOT_IMPLEMENTED',
      message: '준비 중인 기능이에요.',
    });
  });
});
