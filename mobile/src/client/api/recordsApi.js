/**
 * 08 §6 수행 인증 (A40~A46).
 */
import { request } from '../http/httpClient.js';

/**
 * A40 회차 시작 (멱등 필수). 본문 없음.
 * @param {{missionId: string, idempotencyKey: string}} input
 * @returns {Promise<object>} `MissionRecord` (status `recording`)
 */
export function startRecord({ missionId, idempotencyKey }) {
  return request({
    method: 'POST',
    path: `/missions/${encodeURIComponent(missionId)}/records`,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A41 회차 조회. 판정 결과를 기다릴 때 2초마다 부른다.
 * @param {string} recordId
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<object>} `MissionRecord`
 */
export function getRecord(recordId, { signal } = {}) {
  return request({ method: 'GET', path: `/mission-records/${encodeURIComponent(recordId)}`, signal });
}

/**
 * A42 회차 그만하기. `recording`·`uploading`만.
 * @param {string} recordId
 * @returns {Promise<null>}
 */
export function abortRecord(recordId) {
  return request({ method: 'POST', path: `/mission-records/${encodeURIComponent(recordId)}/abort` });
}

/**
 * A43 업로드 URL 받기 (멱등 필수).
 * @param {{recordId: string, mediaKind: string, mimeType: string, sizeBytes: number,
 *          checksumSha256: string, idempotencyKey: string}} input
 * @returns {Promise<{mediaId: string, uploadUrl: string, uploadMethod: string,
 *   uploadHeaders: object, expiresAt: string}>} `MediaUploadTicket`
 */
export function createMediaUpload({ recordId, idempotencyKey, ...body }) {
  return request({
    method: 'POST',
    path: `/mission-records/${encodeURIComponent(recordId)}/media`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A44 업로드 끝 확인. 저장소에 올라간 크기·타입을 서버가 본다.
 * @param {string} mediaId
 * @returns {Promise<object>} `MediaFile`
 */
export function completeMediaUpload(mediaId) {
  return request({ method: 'POST', path: `/media/${encodeURIComponent(mediaId)}/complete` });
}

/**
 * A45 제출 (멱등 필수). 응답은 202이고 판정은 나중에 붙는다.
 * @param {{recordId: string, evidenceKind: 'camera_media'|'sensor_raw',
 *          clientMetrics?: object, idempotencyKey: string}} input
 * @returns {Promise<object>} `MissionRecord` (status `submitted`)
 */
export function submitRecord({ recordId, idempotencyKey, ...body }) {
  return request({
    method: 'POST',
    path: `/mission-records/${encodeURIComponent(recordId)}/submit`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A46 이의 제기 (멱등 필수). 거절된 현재 판정에만, 7일 안에.
 * @param {{resultId: string, reason: string, idempotencyKey: string}} input `reason` 10~500자
 * @returns {Promise<object>} `Appeal`
 */
export function createAppeal({ resultId, idempotencyKey, ...body }) {
  return request({
    method: 'POST',
    path: `/verification-results/${encodeURIComponent(resultId)}/appeals`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

export default {
  startRecord,
  getRecord,
  abortRecord,
  createMediaUpload,
  completeMediaUpload,
  submitRecord,
  createAppeal,
};
