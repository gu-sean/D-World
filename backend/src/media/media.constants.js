// docs/backend/05-verification-media-design.md "3-C-1 미디어"의 제안값 (정책 05가 미결정으로 남긴 항목)
const MB = 1024 * 1024;

/** 종류별 허용 형식·크기·회차당 개수와 파일 확장자 */
export const MEDIA_RULES = {
  camera_photo: {
    mimeTypes: {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    },
    maxBytes: 10 * MB,
    maxPerRecord: 5,
    method: 'camera',
  },
  camera_video: {
    mimeTypes: { 'video/mp4': 'mp4', 'video/quicktime': 'mov' },
    maxBytes: 100 * MB,
    maxPerRecord: 1,
    method: 'camera',
  },
  sensor_raw: {
    mimeTypes: { 'application/json': 'json' },
    maxBytes: 5 * MB,
    maxPerRecord: 1,
    method: 'sensor',
  },
};

export const MEDIA_KINDS = Object.keys(MEDIA_RULES);

/** 조회용(읽기) URL 유효 시간 */
export const DOWNLOAD_URL_TTL_SEC = 300;

/** 파일을 올리거나 지울 수 있는 회차 상태 */
export const OPEN_RECORD_STATUSES = ['recording', 'uploading'];
