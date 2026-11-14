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
