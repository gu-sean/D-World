import { t } from '../../i18n/index.js';
// Texts of this menu that are not shared with the other menus (`constants/labels.js` holds the
// shared ones: noticeCategory, noticeStatus, recommendationConditionType).

// policy_document_versions.document_type (docs/07 §3)
export const policyDocumentType = {
  terms: t('이용약관'),
  privacy: t('개인정보 처리방침'),
  marketing: t('마케팅 수신 동의'),
};

export const audienceType = {
  all: t('전체 회원'),
  users: t('지정 회원'),
};
