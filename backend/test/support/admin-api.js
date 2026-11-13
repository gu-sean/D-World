import { newId } from '../../src/common/ids.js';

// 관리자 챌린지 API 테스트 클라이언트 (팀 문서 09 M51~M61)
// 챌린지 테스트가 쓰는 동작 단위 경로(/challenges/:id/publish 등)를 실제 경로·본문으로 바꿔 보냄
// 이전 API가 사유를 요구하던 동작(숨김·취소·실격·제외·복구·확정·반려)은 본문 그대로 보내고,
// 그 외 변경 요청에는 팀 문서 규칙(모든 변경 요청에 reason)에 맞춰 기본 사유를 붙임
const REASON = '테스트 사유';
const ID = '([^/]+)';

export function adminApi(http, token) {
  const headers = { Authorization: `Bearer ${token}` };

  const request = (method, path, body, key = newId()) => {
    const req = http[method](path).set(headers);
    if (key !== null) req.set('Idempotency-Key', key);
    return req.send(body ?? {});
  };
  const withReason = (body) => ({ reason: REASON, ...body });

  /** 동작 단위 POST를 실제 요청으로 변환 */
  function post(path, body = {}, key) {
    let m;
    if (
      (m = path.match(
        new RegExp(`^/admin/v1/challenges/${ID}/(publish|hide|cancel)$`),
      ))
    ) {
      const withDefault = m[2] === 'publish' ? withReason(body) : body;
      return request(
        'patch',
        `/admin/v1/challenges/${m[1]}`,
        { ...withDefault, action: m[2] },
        key,
      );
    }
    if ((m = path.match(new RegExp(`^/admin/v1/challenges/${ID}/review$`)))) {
      const decision =
        { approve: 'approved', reject: 'rejected' }[body.decision] ??
        body.decision;
      return request(
        'post',
        `/admin/v1/challenges/${m[1]}/reviews`,
        { ...(decision === 'approved' ? withReason(body) : body), decision },
        key,
      );
    }
    if (
      (m = path.match(
        new RegExp(
          `^/admin/v1/challenges/${ID}/participants/${ID}/disqualify$`,
        ),
      ))
    ) {
      return request(
        'post',
        `/admin/v1/challenges/${m[1]}/moderation-actions`,
        { ...body, participationId: m[2], action: 'disqualify' },
        key,
      );
    }
    if (
      (m = path.match(
        new RegExp(
          `^/admin/v1/challenges/${ID}/participants/${ID}/days/${ID}/(exclude|restore)$`,
        ),
      ))
    ) {
      return request(
        'post',
        `/admin/v1/challenges/${m[1]}/moderation-actions`,
        {
          ...body,
          participationId: m[2],
          dailyMissionId: m[3],
          action: `${m[4]}_day`,
        },
        key,
      );
    }
    if (
      (m = path.match(new RegExp(`^/admin/v1/challenges/${ID}/settlements$`)))
    ) {
      return request(
        'post',
        `/admin/v1/challenges/${m[1]}/settlement-runs`,
        withReason(body),
        key,
      );
    }
    if (
      (m = path.match(
        new RegExp(`^/admin/v1/challenges/${ID}/settlements/${ID}/confirm$`),
      ))
    ) {
      return request(
        'post',
        `/admin/v1/settlement-runs/${m[2]}/confirm`,
        body,
        key,
      );
    }
    if (
      (m = path.match(
        new RegExp(
          `^/admin/v1/challenges/${ID}/settlements/${ID}/retry-payments$`,
        ),
      ))
    ) {
      return request(
        'post',
        `/admin/v1/settlement-runs/${m[2]}/payments/retry`,
        withReason(body),
        key,
      );
    }
    return request(
      'post',
      path,
      path === '/admin/v1/challenges' ? withReason(body) : body,
      key,
    );
  }

  function get(path) {
    let m;
    if (
      (m = path.match(
        new RegExp(`^/admin/v1/challenges/${ID}/settlements/${ID}$`),
      ))
    ) {
      return http.get(`/admin/v1/settlement-runs/${m[2]}`).set(headers);
    }
    return http.get(path).set(headers);
  }

  const patch = (path, body, key) =>
    request('patch', path, withReason(body), key);

  return { post, get, patch, request };
}
