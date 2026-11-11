import { randomUUID } from 'node:crypto';

const VALID_ID = /^[\w.-]{8,64}$/;

/** X-Request-Id 헤더를 받아 쓰거나 새로 만들어 요청·응답에 붙임 (팀 문서 03 §7) */
export function requestIdMiddleware(request, response, next) {
  const given = request.headers['x-request-id'];
  const id =
    typeof given === 'string' && VALID_ID.test(given) ? given : randomUUID();
  request.id = id;
  response.setHeader('X-Request-Id', id);
  next();
}
