import { RouterProvider } from 'react-router/dom';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import Providers from './providers.jsx';
import { router } from './router.jsx';

export default function App() {
  return (
    <Providers>
      {/* last resort: an error outside the page area (layout, router) still shows a message */}
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </Providers>
  );
}
