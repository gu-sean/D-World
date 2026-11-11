// Screen text and color of every status value of docs/04 §5.
// labels[kind][value] = { text, color }. `kind` is the camelCase field name (docs/03 §3.2) and
// `value` is the status string as the API sends it. `color` is an antd Tag color.
// Colors: success = done/good, error = failed/rejected, warning = needs attention,
// processing = in progress, default = neutral; blue/purple/gold only tell kinds apart.
// Texts come from the table in docs/04 §5; where that table gives none, the text is local.

export const labels = {
  // goals.status
  goalStatus: {
    active: { text: '진행 중', color: 'processing' },
    paused: { text: '일시정지', color: 'warning' },
    completed: { text: '완료', color: 'success' },
  },
  // goal_steps.status
  goalStepStatus: {
    active: { text: '진행 중', color: 'processing' },
    completed: { text: '완료', color: 'success' },
  },
  // missions.status
  missionStatus: {
    scheduled: { text: '대기', color: 'default' },
    in_progress: { text: '진행 중', color: 'processing' },
    submitted: { text: '인증 중', color: 'processing' },
    completed: { text: '완료', color: 'success' },
    failed: { text: '실패', color: 'error' },
    cancelled: { text: '취소', color: 'default' },
  },
  // missions.source_type
  missionSourceType: {
    user: { text: '직접 추가', color: 'default' },
    template: { text: '기본 미션', color: 'default' },
    ai: { text: 'AI 생성', color: 'purple' },
    challenge: { text: '챌린지', color: 'blue' },
  },
  // missions.cancel_reason
  missionCancelReason: {
    user_cancelled: { text: '직접 취소', color: 'default' },
    goal_deleted: { text: '목표 삭제', color: 'default' },
    plan_adjusted: { text: '계획 조정', color: 'default' },
    challenge_withdrawn: { text: '챌린지 포기', color: 'default' },
    challenge_cancelled: { text: '챌린지 취소', color: 'default' },
  },
  // mission_definitions.publication_status
  missionDefinitionPublicationStatus: {
    draft: { text: '초안', color: 'default' },
    private: { text: '비공개', color: 'default' },
    review_pending: { text: '검수 대기', color: 'warning' },
    public: { text: '공개', color: 'success' },
    rejected: { text: '반려', color: 'error' },
    hidden: { text: '숨김', color: 'default' },
  },
  // ai_plan_proposals.status
  aiPlanProposalStatus: {
    draft: { text: '제안됨', color: 'processing' },
    accepted: { text: '적용됨', color: 'success' },
    rejected: { text: '거절', color: 'error' },
    expired: { text: '만료', color: 'default' },
  },
  // plan_adjustment_proposals.status
  planAdjustmentProposalStatus: {
    proposed: { text: '제안됨', color: 'processing' },
    accepted: { text: '적용됨', color: 'success' },
    rejected: { text: '거절', color: 'error' },
    expired: { text: '만료', color: 'default' },
  },
  // mission_records.status
  recordStatus: {
    recording: { text: '촬영·측정 중', color: 'processing' },
    uploading: { text: '업로드 중', color: 'processing' },
    submitted: { text: '분석 중', color: 'processing' },
    review_required: { text: '검토 중', color: 'warning' },
    approved: { text: '인증 성공', color: 'success' },
    rejected: { text: '인증 실패', color: 'error' },
    superseded: { text: '재판정됨', color: 'default' },
    aborted: { text: '중단', color: 'default' },
  },
  // mission_records.evidence_kind
  recordEvidenceKind: {
    camera_media: { text: '사진·영상', color: 'default' },
    sensor_raw: { text: '센서 원시 파일', color: 'default' },
    sensor_summary: { text: '센서 요약값', color: 'default' },
  },
  // media_files.media_kind
  mediaKind: {
    camera_photo: { text: '사진', color: 'default' },
    camera_video: { text: '영상', color: 'default' },
    sensor_raw: { text: '센서 원시 파일', color: 'default' },
  },
  // media_files.upload_status
  uploadStatus: {
    pending: { text: '대기', color: 'default' },
    uploaded: { text: '업로드 완료', color: 'success' },
    failed: { text: '실패', color: 'error' },
    deleting: { text: '삭제 중', color: 'warning' },
    deleted: { text: '삭제됨', color: 'default' },
  },
  // verification_results.decision
  decision: {
    approved: { text: '승인', color: 'success' },
    rejected: { text: '거절', color: 'error' },
    review_required: { text: '검토 필요', color: 'warning' },
  },
  // verification_results.source
  decisionSource: {
    ai: { text: '자동 판정', color: 'blue' },
    admin: { text: '관리자 판정', color: 'purple' },
  },
  // verification_appeals.status
  verificationAppealStatus: {
    open: { text: '접수', color: 'processing' },
    accepted: { text: '인정(판정 변경)', color: 'success' },
    rejected: { text: '기각(판정 유지)', color: 'error' },
  },
  // point_transactions.kind
  pointTransactionKind: {
    auto_award: { text: '미션·활동 보상', color: 'success' },
    spend: { text: '사용', color: 'default' },
    refund: { text: '환불', color: 'default' },
    manual_grant: { text: '관리자 지급', color: 'purple' },
    manual_recovery: { text: '관리자 회수', color: 'purple' },
    recovery: { text: '회수', color: 'error' },
    recovery_claim: { text: '회수 예정', color: 'warning' },
    recovery_settlement: { text: '회수 정산', color: 'error' },
    recovery_cancel: { text: '회수 취소', color: 'default' },
    reinstatement: { text: '복구', color: 'success' },
    award_offset: { text: '보상 상계', color: 'default' },
    refund_offset: { text: '환불 상계', color: 'default' },
  },
  // point_transactions.source_type
  pointSourceType: {
    mission: { text: '미션', color: 'default' },
    streak: { text: '연속 달성', color: 'default' },
    achievement: { text: '업적', color: 'default' },
    challenge: { text: '챌린지', color: 'default' },
    shop_order: { text: '상점 주문', color: 'default' },
    admin_adjustment: { text: '관리자 조정', color: 'purple' },
  },
  // streak_days.status
  streakDayStatus: {
    pending: { text: '판정 대기', color: 'processing' },
    success: { text: '성공', color: 'success' },
    failed: { text: '실패', color: 'error' },
  },
  // achievement_versions.rarity
  achievementRarity: {
    common: { text: 'Common', color: 'default' },
    rare: { text: 'Rare', color: 'blue' },
    legendary: { text: 'Legendary', color: 'gold' },
  },
  // pet_stage_versions.stage_code
  petStageCode: {
    egg: { text: '알', color: 'default' },
    baby: { text: '아기', color: 'default' },
    adult: { text: '성체', color: 'default' },
  },
  // shop_items.item_kind
  shopItemKind: {
    consumable: { text: '소모품', color: 'default' },
    permanent: { text: '영구', color: 'default' },
  },
  // shop_orders.status
  shopOrderStatus: {
    completed: { text: '완료', color: 'success' },
    cancelled: { text: '취소', color: 'default' },
  },
  // challenges.publication_status
  challengePublicationStatus: {
    draft: { text: '초안', color: 'default' },
    review_pending: { text: '검수 대기', color: 'warning' },
    public: { text: '공개', color: 'success' },
    rejected: { text: '반려', color: 'error' },
    hidden: { text: '숨김', color: 'default' },
    cancelled: { text: '취소', color: 'default' },
  },
  // challenges.settlement_status
  challengeSettlementStatus: {
    not_started: { text: '정산 전', color: 'default' },
    draft: { text: '정산안', color: 'processing' },
    confirmed: { text: '정산 확정', color: 'success' },
  },
  // challenge_participations.status
  challengeParticipationStatus: {
    enrolled: { text: '참여 중', color: 'processing' },
    withdrawn: { text: '중도 포기', color: 'default' },
    disqualified: { text: '실격', color: 'error' },
    completed: { text: '완주', color: 'success' },
    failed: { text: '미달성', color: 'error' },
  },
  // challenge_daily_missions.status
  challengeDailyMissionStatus: {
    pending: { text: '대기', color: 'default' },
    success: { text: '성공', color: 'success' },
    failed: { text: '실패', color: 'error' },
    excluded: { text: '제외', color: 'default' },
    cancelled: { text: '취소', color: 'default' },
  },
  // users.status
  userStatus: {
    active: { text: '정상', color: 'success' },
    withdrawal_processing: { text: '탈퇴 처리 중', color: 'warning' },
  },
  // account_actions.action_type
  accountActionType: {
    warning: { text: '경고', color: 'warning' },
    restriction: { text: '이용 제한', color: 'error' },
  },
  // account_withdrawal_requests.status
  withdrawalRequestStatus: {
    requested: { text: '접수', color: 'processing' },
    cancelled: { text: '철회', color: 'default' },
    on_hold: { text: '보류', color: 'warning' },
    processing: { text: '처리 중', color: 'processing' },
    completed: { text: '완료', color: 'success' },
  },
  // support_tickets.ticket_type
  ticketType: {
    inquiry: { text: '문의', color: 'blue' },
    report: { text: '신고', color: 'error' },
  },
  // support_tickets.status
  ticketStatus: {
    received: { text: '접수', color: 'processing' },
    in_review: { text: '검토 중', color: 'warning' },
    completed: { text: '완료', color: 'success' },
  },
  // support_tickets.target_kind
  ticketTargetKind: {
    user: { text: '회원', color: 'default' },
    mission_definition: { text: '미션', color: 'default' },
    challenge: { text: '챌린지', color: 'default' },
  },
  // support_ticket_resolutions.outcome
  ticketResolutionOutcome: {
    no_action: { text: '문제 없음', color: 'default' },
    reply_only: { text: '답변만', color: 'blue' },
    account_action: { text: '계정 조치', color: 'warning' },
    content_action: { text: '콘텐츠 조치', color: 'warning' },
    both: { text: '계정+콘텐츠', color: 'error' },
  },
  // notices.category
  noticeCategory: {
    service: { text: '서비스', color: 'default' },
    event: { text: '이벤트', color: 'blue' },
    policy: { text: '정책', color: 'purple' },
    marketing: { text: '마케팅', color: 'gold' },
  },
  // notices.status
  noticeStatus: {
    draft: { text: '초안', color: 'default' },
    scheduled: { text: '예약', color: 'processing' },
    published: { text: '게시', color: 'success' },
    cancelled: { text: '취소', color: 'default' },
  },
  // user_notifications.push_status
  pushStatus: {
    none: { text: '없음', color: 'default' },
    pending: { text: '대기', color: 'processing' },
    sent: { text: '발송', color: 'success' },
    failed: { text: '실패', color: 'error' },
    skipped: { text: '건너뜀', color: 'default' },
  },
  // ai_analysis_runs.run_type
  aiRunType: {
    plan_adjustment: { text: '계획 조정', color: 'default' },
    situational_recommendation: { text: '상황별 추천', color: 'default' },
    weekly_report: { text: '주간 리포트', color: 'default' },
    monthly_report: { text: '월간 리포트', color: 'default' },
  },
  // ai_mission_recommendations.status
  aiRecommendationStatus: {
    shown: { text: '표시됨', color: 'processing' },
    accepted: { text: '수락', color: 'success' },
    dismissed: { text: '거절', color: 'default' },
    expired: { text: '만료', color: 'default' },
  },
  // recommendation_messages.condition_type
  recommendationConditionType: {
    always: { text: '항상', color: 'default' },
    no_mission_today: { text: '오늘 미션 없음', color: 'default' },
    streak_at_risk: { text: '연속 달성 위험', color: 'default' },
    inactive_days: { text: '미접속 일수', color: 'default' },
    time_slot: { text: '시간대', color: 'default' },
  },
};
