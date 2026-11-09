/**
 * `globalThis.fetch`를 대신하는 가짜 (parts/mobile-client §9).
 *
 * 요청을 모두 기록하고, 등록해 둔 응답을 돌려준다.
 *
 * ```js
 * const http = installFakeFetch();
 * http.on('POST', '/auth/login', () => ({ status: 200, body: session }));
 * // … 테스트 …
 * assert.equal(http.requests.length, 1);
 * http.restore();
 * ```
 */

/** 경로가 같은지 본다. `/goals/:goalId`처럼 `:이름` 자리는 아무 값이나 받는다. */
function matchPath(pattern, path) {
  if (pattern === path) return {};
  const p = pattern.split('/');
  const a = path.split('/');
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = a[i];
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function installFakeFetch() {
  const original = globalThis.fetch;
  const routes = [];
  const requests = [];

  const fake = async (url, init = {}) => {
    const parsed = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const path = parsed.pathname.replace(/^\/api\/v1/, '');
    const query = Object.fromEntries(parsed.searchParams.entries());
    /** 같은 키가 여러 번 온 경우(배열 쿼리)를 위해 원본도 남긴다. */
    const queryAll = [...parsed.searchParams.entries()];
    const headers = { ...(init.headers ?? {}) };
    let body = null;
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    }
    const record = { method, url: String(url), path, query, queryAll, headers, body, signal: init.signal };
    requests.push(record);

    const route = routes.find((r) => r.method === method && matchPath(r.path, path) !== null);
    if (!route) {
      throw new Error(`fakeFetch: 준비되지 않은 요청 ${method} ${path}`);
    }

    const params = matchPath(route.path, path) ?? {};
    const result = await route.handler({ ...record, params, callNo: route.calls });
    route.calls += 1;

    if (result instanceof Error) throw result;
    if (result && result.networkError) throw new TypeError('Network request failed');
    if (result && result.hang) {
      // 타임아웃 테스트용: AbortController가 끊을 때까지 끝나지 않는다.
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }

    const status = result?.status ?? 200;
    const payload = result?.body;
    const text = payload === undefined || payload === null ? '' : JSON.stringify(payload);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name) => {
          const want = String(name).toLowerCase();
          const found = Object.entries(result?.headers ?? {}).find(([k]) => k.toLowerCase() === want);
          return found ? String(found[1]) : null;
        },
      },
      async json() {
        if (!text) throw new SyntaxError('Unexpected end of JSON input');
        return JSON.parse(text);
      },
      async text() { return text; },
    };
  };

  globalThis.fetch = fake;

  return {
    requests,
    /**
     * 응답을 등록한다. handler는 `{method, path, query, headers, body, params, callNo}`를 받는다.
     * 같은 경로를 다시 등록하면 **나중 것이 이긴다** (setup에서 깔아 둔 기본 응답을 테스트가 덮어쓴다).
     */
    on(method, path, handler) {
      routes.unshift({ method: method.toUpperCase(), path, handler, calls: 0 });
      return this;
    },
    /** 기록된 요청 중 조건에 맞는 것만. */
    find(method, path) {
      return requests.filter((r) => r.method === method.toUpperCase() && matchPath(path, r.path) !== null);
    },
    restore() { globalThis.fetch = original; },
  };
}

export default installFakeFetch;
