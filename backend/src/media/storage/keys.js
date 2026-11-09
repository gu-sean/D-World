// 객체 키 생성은 이 파일 한 곳 (팀 문서 03 §9). 키는 백엔드만 만들고 클라이언트는 받은 URL을 그대로 씀

/** 인증 증빙 (사진·영상·러닝 원시 데이터) */
export const recordMediaKey = ({
  prefix,
  userId,
  recordId,
  mediaId,
  extension,
}) => `${prefix}/users/${userId}/records/${recordId}/${mediaId}.${extension}`;

/** 배지 이미지 (관리자 업로드) */
export const badgeImageKey = ({
  prefix,
  achievementId,
  versionNo,
  extension,
}) => `${prefix}/assets/badges/${achievementId}/v${versionNo}.${extension}`;

/** 펫 단계 이미지 (관리자 업로드) */
export const petImageKey = ({
  prefix,
  speciesId,
  stageCode,
  imageId,
  extension,
}) => `${prefix}/assets/pets/${speciesId}/${stageCode}-${imageId}.${extension}`;
