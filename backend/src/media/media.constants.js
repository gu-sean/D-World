// 팀 문서 05 §9 업로드 규격 (형식·크기)
// 회차당 개수: AI(I01)가 media를 정확히 1개만 받으므로 카메라 증거(사진·영상 합쳐서)는 회차당 1개
const MB = 1024 * 1024;

/** 종류별 허용 형식·크기·회차당 개수와 파일 확장자 */
export const MEDIA_RULES = {
  camera_photo: {
    mimeTypes: { 'image/jpeg': 'jpg' },
    maxBytes: 10 * MB,
    maxPerRecord: 1,
    method: 'camera',
  },
  camera_video: {
    mimeTypes: { 'video/mp4': 'mp4' },
    maxBytes: 80 * MB,
    maxPerRecord: 1,
    method: 'camera',
  },
  sensor_raw: {
    mimeTypes: { 'application/gzip': 'json.gz' },
    maxBytes: 5 * MB,
    maxPerRecord: 1,
    method: 'sensor',
  },
};

export const MEDIA_KINDS = Object.keys(MEDIA_RULES);

/** 조회용(읽기) URL 유효 시간 */
export const DOWNLOAD_URL_TTL_SEC = 3600;
