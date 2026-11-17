import { t } from '../i18n/index.js';
// Screen text and color of every status value of docs/04 §5.
// labels[kind][value] = { text, color }. `kind` is the camelCase field name (docs/03 §3.2) and
// `value` is the status string as the API sends it. `color` is an antd Tag color.
// Colors: success = done/good, error = failed/rejected, warning = needs attention,
// processing = in progress, default = neutral; blue/purple/gold only tell kinds apart.
// Texts come from the table in docs/04 §5; where that table gives none, the text is local.

export const labels = {
  // goals.status
  goalStatus: {
    active: { text: t('진행 중'), color: 'processing' },
    paused: { text: t('일시정지'), color: 'warning' },
    completed: { text: t('완료'), color: 'success' },
  },
  // goal_steps.status
  goalStepStatus: {
    active: { text: t('진행 중'), color: 'processing' },
    completed: { text: t('완료'), color: 'success' },
  },
  // missions.status
  missionStatus: {
    scheduled: { text: t('대기'), color: 'default' },
    in_progress: { text: t('진행 중'), color: 'processing' },
    submitted: { text: t('인증 중'), color: 'processing' },
    completed: { text: t('완료'), color: 'success' },
    failed: { text: t('실패'), color: 'error' },
    cancelled: { text: t('취소'), color: 'default' },
  },
  // missions.source_type
  missionSourceType: {
    user: { text: t('직접 추가'), color: 'default' },
    template: { text: t('기본 미션'), color: 'default' },
    ai: { text: t('AI 생성'), color: 'purple' },
    challenge: { text: t('챌린지'), color: 'blue' },
  },
  // missions.cancel_reason
  missionCancelReason: {
    user_cancelled: { text: t('직접 취소'), color: 'default' },
    goal_deleted: { text: t('목표 삭제'), color: 'default' },
    plan_adjusted: { text: t('계획 조정'), color: 'default' },
    challenge_withdrawn: { text: t('챌린지 포기'), color: 'default' },
    challenge_cancelled: { text: t('챌린지 취소'), color: 'default' },
  },
  // mission_definitions.publication_status
  missionDefinitionPublicationStatus: {
    draft: { text: t('초안'), color: 'default' },
    private: { text: t('비공개'), color: 'default' },
    review_pending: { text: t('검수 대기'), color: 'warning' },
    public: { text: t('공개'), color: 'success' },
    rejected: { text: t('반려'), color: 'error' },
    hidden: { text: t('숨김'), color: 'default' },
  },
  // ai_plan_proposals.status
  aiPlanProposalStatus: {
    draft: { text: t('제안됨'), color: 'processing' },
    accepted: { text: t('적용됨'), color: 'success' },
    rejected: { text: t('거절'), color: 'error' },
    expired: { text: t('만료'), color: 'default' },
  },
  // plan_adjustment_proposals.status
  planAdjustmentProposalStatus: {
    proposed: { text: t('제안됨'), color: 'processing' },
    accepted: { text: t('적용됨'), color: 'success' },
    rejected: { text: t('거절'), color: 'error' },
    expired: { text: t('만료'), color: 'default' },
  },
  // mission_records.status
  recordStatus: {
    recording: { text: t('촬영·측정 중'), color: 'processing' },
    uploading: { text: t('업로드 중'), color: 'processing' },
    submitted: { text: t('분석 중'), color: 'processing' },
    review_required: { text: t('검토 중'), color: 'warning' },
    approved: { text: t('인증 성공'), color: 'success' },
    rejected: { text: t('인증 실패'), color: 'error' },
    superseded: { text: t('재판정됨'), color: 'default' },
    aborted: { text: t('중단'), color: 'default' },
  },
  // mission_records.evidence_kind
  recordEvidenceKind: {
    camera_media: { text: t('사진·영상'), color: 'default' },
    sensor_raw: { text: t('센서 원시 파일'), color: 'default' },
    sensor_summary: { text: t('센서 요약값'), color: 'default' },
  },
  // media_files.media_kind
  mediaKind: {
    camera_photo: { text: t('사진'), color: 'default' },
    camera_video: { text: t('영상'), color: 'default' },
    sensor_raw: { text: t('센서 원시 파일'), color: 'default' },
  },
  // media_files.upload_status
  uploadStatus: {
    pending: { text: t('대기'), color: 'default' },
    uploaded: { text: t('업로드 완료'), color: 'success' },
    failed: { text: t('실패'), color: 'error' },
    deleting: { text: t('삭제 중'), color: 'warning' },
    deleted: { text: t('삭제됨'), color: 'default' },
  },
  // verification_results.decision
  decision: {
    approved: { text: t('승인'), color: 'success' },
    rejected: { text: t('거절'), color: 'error' },
    review_required: { text: t('검토 필요'), color: 'warning' },
  },
  // verification_results.source
  decisionSource: {
    ai: { text: t('자동 판정'), color: 'blue' },
    admin: { text: t('관리자 판정'), color: 'purple' },
  },
  // verification_appeals.status
  verificationAppealStatus: {
    open: { text: t('접수'), color: 'processing' },
    accepted: { text: t('인정(판정 변경)'), color: 'success' },
    rejected: { text: t('기각(판정 유지)'), color: 'error' },
  },
  // point_transactions.kind
  pointTransactionKind: {
    auto_award: { text: t('미션·활동 보상'), color: 'success' },
    spend: { text: t('사용'), color: 'default' },
    refund: { text: t('환불'), color: 'default' },
    manual_grant: { text: t('관리자 지급'), color: 'purple' },
    manual_recovery: { text: t('관리자 회수'), color: 'purple' },
    recovery: { text: t('회수'), color: 'error' },
    recovery_claim: { text: t('회수 예정'), color: 'warning' },
    recovery_settlement: { text: t('회수 정산'), color: 'error' },
    recovery_cancel: { text: t('회수 취소'), color: 'default' },
    reinstatement: { text: t('복구'), color: 'success' },
    award_offset: { text: t('보상 상계'), color: 'default' },
    refund_offset: { text: t('환불 상계'), color: 'default' },
  },
  // point_transactions.source_type
  pointSourceType: {
    mission: { text: t('미션'), color: 'default' },
    streak: { text: t('연속 달성'), color: 'default' },
    achievement: { text: t('업적'), color: 'default' },
    challenge: { text: t('챌린지'), color: 'default' },
    shop_order: { text: t('상점 주문'), color: 'default' },
    admin_adjustment: { text: t('관리자 조정'), color: 'purple' },
  },
  // streak_days.status
  streakDayStatus: {
    pending: { text: t('판정 대기'), color: 'processing' },
    success: { text: t('성공'), color: 'success' },
    failed: { text: t('실패'), color: 'error' },
  },
  // achievement_versions.rarity
  achievementRarity: {
    common: { text: 'Common', color: 'default' },
    rare: { text: 'Rare', color: 'blue' },
    legendary: { text: 'Legendary', color: 'gold' },
  },
  // pet_stage_versions.stage_code
  petStageCode: {
    egg: { text: t('알'), color: 'default' },
    baby: { text: t('아기'), color: 'default' },
    adult: { text: t('성체'), color: 'default' },
  },
  // shop_items.item_kind
  shopItemKind: {
    consumable: { text: t('소모품'), color: 'default' },
    permanent: { text: t('영구'), color: 'default' },
  },
  // shop_orders.status
  shopOrderStatus: {
    completed: { text: t('완료'), color: 'success' },
    cancelled: { text: t('취소'), color: 'default' },
  },
  // challenges.publication_status
  challengePublicationStatus: {
    draft: { text: t('초안'), color: 'default' },
    review_pending: { text: t('검수 대기'), color: 'warning' },
    public: { text: t('공개'), color: 'success' },
    rejected: { text: t('반려'), color: 'error' },
    hidden: { text: t('숨김'), color: 'default' },
    cancelled: { text: t('취소'), color: 'default' },
  },
  // challenges.settlement_status
  challengeSettlementStatus: {
    not_started: { text: t('정산 전'), color: 'default' },
    draft: { text: t('정산안'), color: 'processing' },
    confirmed: { text: t('정산 확정'), color: 'success' },
  },
  // challenge_participations.status
  challengeParticipationStatus: {
    enrolled: { text: t('참여 중'), color: 'processing' },
    withdrawn: { text: t('중도 포기'), color: 'default' },
    disqualified: { text: t('실격'), color: 'error' },
    completed: { text: t('완주'), color: 'success' },
    failed: { text: t('미달성'), color: 'error' },
  },
  // challenge_daily_missions.status
  challengeDailyMissionStatus: {
    pending: { text: t('대기'), color: 'default' },
    success: { text: t('성공'), color: 'success' },
    failed: { text: t('실패'), color: 'error' },
    excluded: { text: t('제외'), color: 'default' },
    cancelled: { text: t('취소'), color: 'default' },
  },
  // users.status
  userStatus: {
    active: { text: t('정상'), color: 'success' },
    withdrawal_processing: { text: t('탈퇴 처리 중'), color: 'warning' },
  },
  // account_actions.action_type
  accountActionType: {
    warning: { text: t('경고'), color: 'warning' },
    restriction: { text: t('이용 제한'), color: 'error' },
  },
  // account_withdrawal_requests.status
  withdrawalRequestStatus: {
    requested: { text: t('접수'), color: 'processing' },
    cancelled: { text: t('철회'), color: 'default' },
    on_hold: { text: t('보류'), color: 'warning' },
    processing: { text: t('처리 중'), color: 'processing' },
    completed: { text: t('완료'), color: 'success' },
  },
  // support_tickets.ticket_type
  ticketType: {
    inquiry: { text: t('문의'), color: 'blue' },
    report: { text: t('신고'), color: 'error' },
  },
  // support_tickets.status
  ticketStatus: {
    received: { text: t('접수'), color: 'processing' },
    in_review: { text: t('검토 중'), color: 'warning' },
    completed: { text: t('완료'), color: 'success' },
  },
  // support_tickets.target_kind
  ticketTargetKind: {
    user: { text: t('회원'), color: 'default' },
    mission_definition: { text: t('미션'), color: 'default' },
    challenge: { text: t('챌린지'), color: 'default' },
  },
  // support_tickets.category (user-support.service.js 허용 값)
  ticketCategory: {
    account: { text: t('계정'), color: 'default' },
    mission: { text: t('미션'), color: 'default' },
    verification: { text: t('인증'), color: 'default' },
    points: { text: t('포인트'), color: 'default' },
    challenge: { text: t('챌린지'), color: 'default' },
    other: { text: t('기타'), color: 'default' },
  },
  // support_ticket_resolutions.outcome
  ticketResolutionOutcome: {
    no_action: { text: t('문제 없음'), color: 'default' },
    reply_only: { text: t('답변만'), color: 'blue' },
    account_action: { text: t('계정 조치'), color: 'warning' },
    content_action: { text: t('콘텐츠 조치'), color: 'warning' },
    both: { text: t('계정+콘텐츠'), color: 'error' },
  },
  // notices.category
  noticeCategory: {
    service: { text: t('서비스'), color: 'default' },
    event: { text: t('이벤트'), color: 'blue' },
    policy: { text: t('정책'), color: 'purple' },
    marketing: { text: t('마케팅'), color: 'gold' },
  },
  // notices.status
  noticeStatus: {
    draft: { text: t('초안'), color: 'default' },
    scheduled: { text: t('예약'), color: 'processing' },
    published: { text: t('게시'), color: 'success' },
    cancelled: { text: t('취소'), color: 'default' },
  },
  // user_notifications.push_status
  pushStatus: {
    none: { text: t('없음'), color: 'default' },
    pending: { text: t('대기'), color: 'processing' },
    sent: { text: t('발송'), color: 'success' },
    failed: { text: t('실패'), color: 'error' },
    skipped: { text: t('건너뜀'), color: 'default' },
  },
  // ai_analysis_runs.run_type
  aiRunType: {
    plan_adjustment: { text: t('계획 조정'), color: 'default' },
    situational_recommendation: { text: t('상황별 추천'), color: 'default' },
    weekly_report: { text: t('주간 리포트'), color: 'default' },
    monthly_report: { text: t('월간 리포트'), color: 'default' },
  },
  // ai_mission_recommendations.status
  aiRecommendationStatus: {
    shown: { text: t('표시됨'), color: 'processing' },
    accepted: { text: t('수락'), color: 'success' },
    dismissed: { text: t('거절'), color: 'default' },
    expired: { text: t('만료'), color: 'default' },
  },
  // recommendation_messages.condition_type
  recommendationConditionType: {
    always: { text: t('항상'), color: 'default' },
    no_mission_today: { text: t('오늘 미션 없음'), color: 'default' },
    streak_at_risk: { text: t('연속 달성 위험'), color: 'default' },
    inactive_days: { text: t('미접속 일수'), color: 'default' },
    time_slot: { text: t('시간대'), color: 'default' },
  },
};
