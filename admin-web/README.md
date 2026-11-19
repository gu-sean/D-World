# admin-web

D-World admin console (React 19 + Vite, JavaScript). Full environment setup: [docs/12-개발환경.md](../docs/12-개발환경.md).

## Setup

```bash
npm ci                      # or `npm install` the first time (creates package-lock.json)
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npm run format              # first time only: normalizes formatting before the lint check
```

## Environment variables

| Name                      | Default     | Meaning                                                  |
| ------------------------- | ----------- | -------------------------------------------------------- |
| `VITE_ADMIN_API_BASE_URL` | `/admin/v1` | Admin API base path (proxied to `http://localhost:3000`) |

## Run

```bash
npm run dev     # http://localhost:5173
```

## Lint (run before every PR)

```bash
npm run lint
```

## Test

```bash
npm test          # Vitest (jsdom), once
npm run test:watch
```

Tests live next to the code (`*.test.js` / `*.test.jsx`).

## Security and failures

- Access token lives in memory only; the refresh token is an HttpOnly cookie (set by the server).
- Any 401 on a normal request refreshes once and repeats it; if that fails the admin goes to the login page and cached data is dropped.
- 30 minutes without activity logs the admin out (`src/app/useIdleLogout.js`).
- Production build adds a Content-Security-Policy `<meta>` (`vite.config.js`). Where the files are served also set the headers `frame-ancestors 'none'` (or `X-Frame-Options: DENY`), `X-Content-Type-Options: nosniff` and HSTS; a meta tag cannot do these.
- Reads are repeated only when the server could not be reached (`src/api/retryPolicy.js`); every answer of the server is shown at once.
- A render error shows a message instead of a blank page (`src/components/ErrorBoundary.jsx`); offline shows a banner.
