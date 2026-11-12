/**
 * 상태값 → 화면 문구 (04 §5 표를 그대로 옮긴 것).
 *
 * 쓰는 법: `labels.missionStatus.completed === '완료'`,
 * 모르는 값까지 안전하게 바꾸려면 `labelOf('missionStatus', value)`.
 *
 * **이 파일에 없는 상태값 묶음**은 04 §5에 한국어 문구가 없는 것들이다
 * (`media_files.media_kind`·`media_files.upload_status`·`point_transactions.source_type`·
 * `user_notifications.push_status`·`ai_analysis_runs.run_type`·
 * `recommendation_messages.condition_type`). 모두 화면에 그대로 내보이지 않는 값이라
 * 임의로 문구를 지어내지 않았다. 화면에 필요해지면 04를 먼저 고친다.
 */

/** 04 §5 목표·미션 */
export const goalStatus = { active: '진행 중', paused: '일시정지', completed: '완료' };
export const goalStepStatus = { active: '진행 중', completed: '완료' };
export const missionStatus = {
  scheduled: '대기',
  in_progress: '진행 중',
  submitted: '인증 중',
  completed: '완료',
  failed: '실패',
  cancelled: '취소',
};
export const missionSourceType = {
  user: '직접 추가',
  template: '기본 미션',
  ai: 'AI 생성',
  challenge: '챌린지',
};
export const missionCancelReason = {
  user_cancelled: '직접 취소',
  goal_deleted: '목표 삭제',
  plan_adjusted: '계획 조정',
  challenge_withdrawn: '챌린지 포기',
  challenge_cancelled: '챌린지 취소',
};
export const missionDefinitionPublicationStatus = {
  draft: '초안',
  private: '비공개',
  review_pending: '검수 대기',
  public: '공개',
  rejected: '반려',
  hidden: '숨김',
};
export const planProposalStatus = {
  draft: '제안됨',
  accepted: '적용됨',
  rejected: '거절',
  expired: '만료',
};
export const planAdjustmentStatus = {
  proposed: '제안됨',
  accepted: '적용됨',
  rejected: '거절',
  expired: '만료',
};

/** 04 §5 수행 인증. `review_required`는 성공이 아니다 — 보상 표시를 하지 않는다. */
export const recordStatus = {
  recording: '촬영·측정 중',
  uploading: '업로드 중',
  submitted: '분석 중',
  review_required: '검토 중',
  approved: '인증 성공',
  rejected: '인증 실패',
  superseded: '재판정됨',
  aborted: '중단',
};
export const evidenceKind = {
  camera_media: '사진·영상',
  sensor_raw: '센서 원시 파일',
  sensor_summary: '센서 요약값',
};
export const decision = { approved: '승인', rejected: '거절', review_required: '검토 필요' };
export const decisionSource = { ai: '자동 판정', admin: '관리자 판정' };
export const appealStatus = {
  open: '접수',
  accepted: '인정(판정 변경)',
  rejected: '기각(판정 유지)',
};

/** 04 §5 보상·게임화 */
export const pointTransactionKind = {
  auto_award: '미션·활동 보상',
  spend: '사용',
  refund: '환불',
  manual_grant: '관리자 지급',
  manual_recovery: '관리자 회수',
  recovery: '회수',
  recovery_claim: '회수 예정',
  recovery_settlement: '회수 정산',
  recovery_cancel: '회수 취소',
  reinstatement: '복구',
  award_offset: '보상 상계',
  refund_offset: '환불 상계',
};
export const streakDayStatus = { pending: '판정 대기', success: '성공', failed: '실패' };
export const achievementRarity = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };
export const petStageCode = { egg: '알', baby: '아기', adult: '성체' };
export const shopItemKind = { consumable: '소모품', permanent: '영구' };
export const shopOrderStatus = { completed: '완료', cancelled: '취소' };

/** 04 §5 챌린지 */
export const challengePublicationStatus = {
  draft: '초안',
  review_pending: '검수 대기',
  public: '공개',
  rejected: '반려',
  hidden: '숨김',
  cancelled: '취소',
};
/** 07 §14 `Challenge.phase` (11 §3.2) */
export const challengePhase = {
  recruiting: '모집 중',
  ongoing: '진행 중',
  ended: '끝남',
};
export const challengeSettlementStatus = {
  not_started: '정산 전',
  draft: '정산안',
  confirmed: '정산 확정',
};
export const challengeParticipationStatus = {
  enrolled: '참여 중',
  withdrawn: '중도 포기',
  disqualified: '실격',
  completed: '완주',
  failed: '미달성',
};
export const challengeDailyMissionStatus = {
  pending: '대기',
  success: '성공',
  failed: '실패',
  excluded: '제외',
  cancelled: '취소',
};

/** 07 §2 `PolicyDocument.documentType` */
export const policyDocumentType = {
  terms: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  marketing: '마케팅 정보 수신',
};

/** 04 §5 계정·운영 */
export const userStatus = { active: '정상', withdrawal_processing: '탈퇴 처리 중' };
export const accountActionType = { warning: '경고', restriction: '이용 제한' };
export const withdrawalStatus = {
  requested: '접수',
  cancelled: '철회',
  on_hold: '보류',
  processing: '처리 중',
  completed: '완료',
};
export const ticketType = { inquiry: '문의', report: '신고' };
/** 07 §15 `SupportTicketInput.category` — 문의와 신고가 쓰는 값을 한 표에 모았다. */
export const ticketCategory = {
  account: '계정',
  mission: '미션',
  verification: '인증',
  points: '포인트',
  challenge: '챌린지',
  abuse: '욕설·괴롭힘',
  inappropriate_content: '부적절한 내용',
  cheating: '부정 인증',
  impersonation: '사칭',
  other: '기타',
};
export const ticketStatus = { received: '접수', in_review: '검토 중', completed: '완료' };
export const ticketTargetKind = {
  user: '회원',
  mission_definition: '미션',
  challenge: '챌린지',
};
export const ticketOutcome = {
  no_action: '문제 없음',
  reply_only: '답변만',
  account_action: '계정 조치',
  content_action: '콘텐츠 조치',
  both: '계정+콘텐츠',
};
export const noticeCategory = {
  service: '서비스',
  event: '이벤트',
  policy: '정책',
  marketing: '마케팅',
};
export const noticeStatus = {
  draft: '초안',
  scheduled: '예약',
  published: '게시',
  cancelled: '취소',
};
export const recommendationStatus = {
  shown: '표시됨',
  accepted: '수락',
  dismissed: '거절',
  expired: '만료',
};
/** 07 §13 `MissionRecommendation.context.weather` */
export const weatherCode = {
  clear: '맑음',
  clouds: '흐림',
  rain: '비',
  snow: '눈',
  hot: '더움',
  cold: '추움',
  dust: '미세먼지',
  unknown: '알 수 없음',
};
/** 07 §13 `MissionRecommendation.context.timeSlot` */
export const timeSlot = {
  morning: '아침',
  afternoon: '낮',
  evening: '저녁',
  night: '밤',
};

/** 04 §4 운동 종류 */
export const exerciseCode = {
  push_up: '푸시업',
  burpee: '버피 테스트',
  squat: '스쿼트',
  lunge: '런지',
  plank: '플랭크',
  running: '러닝',
};

/** 04 §6 단위 (값까지 붙인 문구는 `format.formatTarget`) */
export const targetUnit = {
  reps: '회',
  seconds: '초',
  meters: 'm',
  steps: '걸음',
  pages: '쪽',
  times: '회',
  days: '일',
};

export const labels = {
  goalStatus,
  goalStepStatus,
  missionStatus,
  missionSourceType,
  missionCancelReason,
  missionDefinitionPublicationStatus,
  planProposalStatus,
  planAdjustmentStatus,
  recordStatus,
  evidenceKind,
  decision,
  decisionSource,
  appealStatus,
  pointTransactionKind,
  streakDayStatus,
  achievementRarity,
  petStageCode,
  shopItemKind,
  shopOrderStatus,
  challengePublicationStatus,
  challengePhase,
  challengeSettlementStatus,
  challengeParticipationStatus,
  challengeDailyMissionStatus,
  policyDocumentType,
  userStatus,
  accountActionType,
  withdrawalStatus,
  ticketType,
  ticketCategory,
  ticketStatus,
  ticketTargetKind,
  ticketOutcome,
  noticeCategory,
  noticeStatus,
  recommendationStatus,
  weatherCode,
  timeSlot,
  exerciseCode,
  targetUnit,
};

/**
 * 모르는 값이 와도 화면이 비지 않도록 값을 그대로 돌려준다.
 * @param {keyof typeof labels} group
 * @param {string} value
 * @returns {string}
 */
export function labelOf(group, value) {
  if (value === undefined || value === null) return '';
  return labels[group]?.[value] ?? String(value);
}

export default labels;
