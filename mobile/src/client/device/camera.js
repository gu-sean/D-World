/**
 * 촬영 (parts/mobile-client §6).
 *
 * `react-native-image-picker`를 감싸서 결과를 항상 같은 모양으로 돌려주고,
 * 실패는 `AppError`로 바꾼다.
 */
import { launchCamera } from 'react-native-image-picker';

import AppError from '../http/AppError.js';
import { ensure } from './permissions.js';

/** 영상 최대 길이 (05 §11, parts/ai §4). */
export const VIDEO_DURATION_LIMIT_SECONDS = 120;

/** `file:///a/b.mp4` → `/a/b.mp4`. blob-util은 접두사 없는 경로를 쓴다. */
export function stripFileScheme(uri) {
  if (typeof uri !== 'string') return '';
  return uri.replace(/^file:\/\//, '');
}

async function capture(options, mimeType) {
  const status = await ensure('camera');
  if (status !== 'granted') {
    throw new AppError('PERMISSION_DENIED', 0, undefined, { kind: 'camera', status });
  }

  let result;
  try {
    result = await launchCamera({ saveToPhotos: false, ...options });
  } catch {
    throw new AppError('CAPTURE_CANCELLED', 0);
  }

  if (result?.didCancel) throw new AppError('CAPTURE_CANCELLED', 0);
  if (result?.errorCode === 'permission') {
    throw new AppError('PERMISSION_DENIED', 0, undefined, { kind: 'camera', status: 'blocked' });
  }
  if (result?.errorCode) {
    throw new AppError('CAPTURE_CANCELLED', 0, undefined, { errorCode: result.errorCode });
  }

  const asset = result?.assets?.[0];
  if (!asset?.uri) throw new AppError('CAPTURE_CANCELLED', 0);

  return {
    path: stripFileScheme(asset.uri),
    sizeBytes: asset.fileSize ?? null,
    mimeType,
    // image-picker는 밀리초가 아니라 초로 준다.
    durationSeconds: typeof asset.duration === 'number' ? asset.duration : null,
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

/**
 * 운동 영상 촬영 (parts/mobile-client §6).
 * @returns {Promise<{path: string, sizeBytes: number|null, mimeType: 'video/mp4', durationSeconds: number|null}>}
 * @throws {AppError} `PERMISSION_DENIED` · `CAPTURE_CANCELLED`
 */
export function captureVideo() {
  return capture(
    {
      mediaType: 'video',
      videoQuality: 'high',
      durationLimit: VIDEO_DURATION_LIMIT_SECONDS,
      saveToPhotos: false,
    },
    'video/mp4',
  );
}

/**
 * 학습·생활습관 미션 사진 촬영.
 * @returns {Promise<{path: string, sizeBytes: number|null, mimeType: 'image/jpeg'}>}
 * @throws {AppError} `PERMISSION_DENIED` · `CAPTURE_CANCELLED`
 */
export function capturePhoto() {
  return capture(
    {
      mediaType: 'photo',
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
      saveToPhotos: false,
    },
    'image/jpeg',
  );
}

export default { captureVideo, capturePhoto, stripFileScheme, VIDEO_DURATION_LIMIT_SECONDS };
