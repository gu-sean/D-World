/**
 * 모바일 클라이언트(`mobile/src/client/api`, 팀 문서 08)의 경로를 기존 백엔드 경로로 연결
 *
 * 경로·메서드만 바꾸는 별칭이다. 요청 본문은 그대로 전달하므로
 * 본문·응답 모양까지 같은 항목만 여기에 둔다(다르면 컨트롤러를 새로 만든다).
 * 앱 API(/api/v1) 요청에만 적용되고, 같은 이름의 원래 경로는 그대로 동작한다.
 */
const PREFIX = '/api/v1';

// [클라이언트 메서드, 클라이언트 경로(:param 가능), 백엔드 메서드, 백엔드 경로]
const RULES = [
  ['GET', '/goal-categories', 'GET', '/categories'],
  [
    'PUT',
    '/me/representative-badge',
    'PATCH',
    '/me/profile/representative-achievement',
  ],
  ['GET', '/auth/nickname-availability', 'GET', '/nicknames/availability'],
  ['POST', '/support-tickets', 'POST', '/me/support-tickets'],
  ['GET', '/support-tickets/:id', 'GET', '/me/support-tickets/:id'],
].map(([method, from, targetMethod, to]) => ({
  method,
  targetMethod,
  to,
  pattern: new RegExp(`^${from.replace(/:\w+/g, '([^/?]+)')}$`),
}));

/** { method, path } → 바뀐 { method, path } 또는 null */
export function rewriteMobilePath(method, path) {
  for (const rule of RULES) {
    if (rule.method !== method) continue;
    const match = rule.pattern.exec(path);
    if (!match) continue;
    let index = 0;
    return {
      method: rule.targetMethod,
      path: rule.to.replace(/:\w+/g, () => match[++index]),
    };
  }
  return null;
}

export function mobileCompatMiddleware(request, response, next) {
  if (request.url.startsWith(`${PREFIX}/`)) {
    const queryAt = request.url.indexOf('?');
    const path = (
      queryAt < 0 ? request.url : request.url.slice(0, queryAt)
    ).slice(PREFIX.length);
    const rewritten = rewriteMobilePath(request.method, path);
    if (rewritten) {
      request.url = `${PREFIX}${rewritten.path}${queryAt < 0 ? '' : request.url.slice(queryAt)}`;
      request.method = rewritten.method;
    }
  }
  next();
}
