import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

// Shows the current URL path and query, so that a test can read what a page wrote to the URL.
function LocationProbe() {
  const { pathname, search } = useLocation();
  return createElement('div', { 'data-testid': 'location' }, pathname + search);
}

/**
 * Renders a page the way the app does: a router at `url`, TanStack Query without retries (a
 * failing request shows its error at once) and a `LocationProbe` (`screen.getByTestId('location')`).
 * @param {import('react').ReactElement} ui
 * @param {{url?: string}} [options]
 */
export function renderWithProviders(ui, { url = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries: [url] }, ui, createElement(LocationProbe)),
    ),
  );
}
