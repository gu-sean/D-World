/**
 * 증빙 파일 올리기 (parts/mobile-client §6 `uploading` 칸).
 *
 * 순서: **A43**(업로드 URL 받기) → **저장소에 직접 PUT** → **A44**(올라갔는지 확인).
 * 앱은 저장소 키를 갖지 않는다. 서버가 준 서명 URL로만 올린다 (02 §2).
 *
 * 서명 URL은 15분짜리다. PUT이 403이면 만료로 보고 A43을 한 번 더 불러 새 URL로 재시도한다.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';

import AppError from '../http/AppError.js';
import { newIdempotencyKey } from '../http/idempotency.js';
import { createMediaUpload, completeMediaUpload } from '../api/recordsApi.js';

/** PUT 응답에서 상태 코드를 꺼낸다 (blob-util 버전에 따라 자리가 다르다). */
function statusOf(response) {
  const fromInfo = typeof response?.info === 'function' ? response.info()?.status : undefined;
  return Number(fromInfo ?? response?.respInfo?.status ?? 0);
}

/**
 * @typedef {object} EvidenceFile
 * @property {string} path 접두사 없는 로컬 경로
 * @property {'camera_video'|'camera_photo'|'sensor_raw'} mediaKind
 * @property {'video/mp4'|'image/jpeg'|'application/gzip'} mimeType
 * @property {number} sizeBytes
 * @property {string} checksumSha256 소문자 hex 64자
 */

/**
 * 파일 하나를 올리고 확인까지 끝낸다.
 *
 * @param {string} recordId A40에서 받은 회차 ID
 * @param {EvidenceFile} file
 * @param {object} [options]
 * @param {(progress: number) => void} [options.onProgress] 0~1
 * @param {string} [options.idempotencyKey] A43에 쓸 키. 재시도 때 같은 값을 넘긴다
 * @returns {Promise<object>} A44의 `MediaFile`
 * @throws {AppError} `UPLOAD_FAILED` 또는 서버가 준 코드 그대로
 */
export async function uploadEvidence(recordId, file, { onProgress, idempotencyKey } = {}) {
  const key = idempotencyKey ?? newIdempotencyKey();

  // 1) A43 — 서명 URL 받기
  let ticket = await createMediaUpload({
    recordId,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    checksumSha256: file.checksumSha256,
    idempotencyKey: key,
  });

  // 2) 저장소에 PUT. 403이면 URL 만료로 보고 새 URL로 한 번 더.
  let status = await putFile(ticket, file, onProgress);
  if (status === 403) {
    ticket = await createMediaUpload({
      recordId,
      mediaKind: file.mediaKind,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksumSha256: file.checksumSha256,
      idempotencyKey: newIdempotencyKey(),
    });
    status = await putFile(ticket, file, onProgress);
  }
  if (status < 200 || status >= 300) {
    throw new AppError('UPLOAD_FAILED', 0, undefined, { status });
  }

  // 3) A44 — 서버가 저장소를 확인한다
  return completeMediaUpload(ticket.mediaId);
}

async function putFile(ticket, file, onProgress) {
  onProgress?.(0);
  let task;
  try {
    task = ReactNativeBlobUtil.fetch(
      ticket.uploadMethod ?? 'PUT',
      ticket.uploadUrl,
      ticket.uploadHeaders ?? { 'Content-Type': file.mimeType },
      ReactNativeBlobUtil.wrap(file.path),
    );
  } catch {
    throw new AppError('UPLOAD_FAILED', 0);
  }

  if (onProgress && typeof task.uploadProgress === 'function') {
    task.uploadProgress((written, total) => {
      const ratio = Number(total) > 0 ? Number(written) / Number(total) : 0;
      onProgress(Math.max(0, Math.min(1, ratio)));
    });
  }

  let response;
  try {
    response = await task;
  } catch {
    throw new AppError('UPLOAD_FAILED', 0);
  }

  const status = statusOf(response);
  if (status >= 200 && status < 300) onProgress?.(1);
  return status;
}

export default uploadEvidence;
