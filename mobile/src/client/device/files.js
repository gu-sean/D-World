/**
 * 파일 다루기 (parts/mobile-client §6·§8).
 *
 * 영상 줄이기, SHA-256 계산, 크기 확인, gzip JSON 쓰기, 지우기.
 * 모든 실패는 `AppError`로 바꾼다.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Video } from 'react-native-compressor';
import pako from 'pako';

import AppError from '../http/AppError.js';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * 바이트 배열을 base64 문자열로. RN(Hermes)에는 `btoa`가 없고,
 * `Buffer`를 끌어오고 싶지 않아서 직접 만든다.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/** 앱 캐시 폴더. 판정이 끝나면 여기 파일을 지운다 (§8). */
export function cacheDir() {
  return ReactNativeBlobUtil.fs.dirs.CacheDir;
}

/**
 * 영상을 서버 분석 규격(긴 변 1280px·2.5Mbps)으로 줄인다 (parts/mobile-client §6).
 * `preserveMetadata: false`로 영상에 든 촬영 위치(GPS)를 지운다 — 좌표 저장 금지.
 * @param {string} path 접두사 없는 경로
 * @returns {Promise<string>} 줄인 파일 경로 (실패하면 원본 경로)
 */
export async function compressVideo(path) {
  try {
    const result = await Video.compress(`file://${path}`, {
      compressionMethod: 'manual',
      maxSize: 1280,
      bitrate: 2500000,
      preserveMetadata: false,
    });
    return typeof result === 'string' ? result.replace(/^file:\/\//, '') : path;
  } catch {
    // 줄이지 못해도 원본으로 올려 본다. 크기 검사는 부르는 쪽이 한다.
    return path;
  }
}

/**
 * 파일의 SHA-256 (A43 `checksumSha256`, 소문자 hex 64자).
 * @param {string} path
 * @returns {Promise<string>}
 * @throws {AppError} `UPLOAD_FAILED`
 */
export async function sha256OfFile(path) {
  try {
    const hash = await ReactNativeBlobUtil.fs.hash(path, 'sha256');
    return String(hash).toLowerCase();
  } catch {
    throw new AppError('UPLOAD_FAILED', 0);
  }
}

/**
 * 파일 크기(byte).
 * @param {string} path
 * @returns {Promise<{sizeBytes: number}>}
 * @throws {AppError} `UPLOAD_FAILED`
 */
export async function statFile(path) {
  try {
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    return { sizeBytes: Number(stat?.size ?? 0) };
  } catch {
    throw new AppError('UPLOAD_FAILED', 0);
  }
}

/**
 * 객체를 JSON → gzip → 파일로 쓴다 (§8 러닝 원시 데이터).
 * @param {string} path 쓸 경로
 * @param {object} value
 * @returns {Promise<{path: string, sizeBytes: number}>}
 * @throws {AppError} `UPLOAD_FAILED`
 */
export async function writeGzipJson(path, value) {
  let base64;
  let byteLength;
  try {
    const packed = pako.gzip(JSON.stringify(value));
    byteLength = packed.length;
    base64 = bytesToBase64(packed);
  } catch {
    throw new AppError('UPLOAD_FAILED', 0);
  }
  try {
    await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
  } catch {
    throw new AppError('UPLOAD_FAILED', 0);
  }
  return { path, sizeBytes: byteLength };
}

/**
 * 파일을 지운다. 없어도 조용히 넘어간다.
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function removeFile(path) {
  if (!path) return;
  try {
    await ReactNativeBlobUtil.fs.unlink(path);
  } catch {
    // 이미 없는 파일을 지우는 건 실패가 아니다.
  }
}

export default {
  bytesToBase64,
  cacheDir,
  compressVideo,
  sha256OfFile,
  statFile,
  writeGzipJson,
  removeFile,
};
