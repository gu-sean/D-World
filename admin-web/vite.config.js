import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content-Security-Policy for the production build (a `<meta>` tag; the dev server needs inline
 * scripts for hot reload, so it is left out there). Only what the screens really load is allowed:
 *  - scripts only from this site (no inline scripts, no eval)
 *  - styles from this site and inline (antd writes style tags)
 *  - images / videos from this site, data/blob URLs and https (signed storage URLs)
 *  - requests to this site, and https for the signed upload URL of the storage
 * `frame-ancestors` (no embedding in other sites) cannot be set from a meta tag: set it, with
 * `X-Content-Type-Options: nosniff` and HSTS, as a response header where the files are served.
 */
const contentSecurityPolicy = (apiBase) => {
  const apiOrigin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : null;
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https:${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
};

const securityMeta = (apiBase) => ({
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(apiBase) },
      injectTo: 'head-prepend',
    },
  ],
});

// Dev server: /admin/v1 is proxied to the backend so cookies stay same-origin (docs/12 §8.3).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), securityMeta(env.VITE_ADMIN_API_BASE_URL ?? '')],
    test: {
      environment: 'jsdom',
      setupFiles: ['src/setupTests.js'],
      include: ['src/**/*.test.{js,jsx}'],
    },
    server: {
      port: 5173,
      proxy: { '/admin/v1': 'http://localhost:3000' },
    },
  };
});
