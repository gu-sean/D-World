# admin-web

D-World admin console (React 19 + Vite, JavaScript). Full environment setup: [docs/12-개발환경.md](../docs/12-개발환경.md).

## Setup

```bash
npm ci                      # or `npm install` the first time (creates package-lock.json)
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npx msw init public --save  # first time only: creates public/mockServiceWorker.js
npm run format              # first time only: normalizes formatting before the lint check
```

## Environment variables

| Name                      | Default     | Meaning                                                  |
| ------------------------- | ----------- | -------------------------------------------------------- |
| `VITE_ADMIN_API_BASE_URL` | `/admin/v1` | Admin API base path (proxied to `http://localhost:3000`) |
| `VITE_USE_MSW`            | `false`     | `true` = use MSW mock responses, no backend needed       |

## Run

```bash
npm run dev     # http://localhost:5173
```

## Test and lint (run both before every PR)

```bash
npm run lint && npm test
```

## Mock handlers

Each menu puts its MSW handlers in `src/features/<menu>/mocks.js` and exports them as a named
`handlers` array. `src/mocks/browser.js` collects them automatically.

In tests, import the shared server from `src/test/setup.js` and add handlers with `server.use(...)`.
