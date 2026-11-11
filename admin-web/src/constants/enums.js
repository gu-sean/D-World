// Status values of docs/04 §5. Object name = PascalCase, key = UPPER_SNAKE, value = the DB/API
// string as it is (docs/03 §3.2). The comment of each object is its "table.field" in 04 §5.
// Texts and colors are in labels.js. Do not write status strings by hand in the screens.

// goals.status
export const GoalStatus = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

// goal_steps.status
export const GoalStepStatus = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
});

// missions.status
export const MissionStatus = Object.freeze({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

// missions.source_type
export const MissionSourceType = Object.freeze({
  USER: 'user',
  TEMPLATE: 'template',
  AI: 'ai',
  CHALLENGE: 'challenge',
});

// missions.cancel_reason
export const MissionCancelReason = Object.freeze({
  USER_CANCELLED: 'user_cancelled',
  GOAL_DELETED: 'goal_deleted',
  PLAN_ADJUSTED: 'plan_adjusted',
  CHALLENGE_WITHDRAWN: 'challenge_withdrawn',
  CHALLENGE_CANCELLED: 'challenge_cancelled',
});

// mission_definitions.publication_status
export const MissionDefinitionPublicationStatus = Object.freeze({
  DRAFT: 'draft',
  PRIVATE: 'private',
  REVIEW_PENDING: 'review_pending',
  PUBLIC: 'public',
  REJECTED: 'rejected',
  HIDDEN: 'hidden',
});

// ai_plan_proposals.status
export const AiPlanProposalStatus = Object.freeze({
  DRAFT: 'draft',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

// plan_adjustment_proposals.status
export const PlanAdjustmentProposalStatus = Object.freeze({
  PROPOSED: 'proposed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

// mission_records.status
export const RecordStatus = Object.freeze({
  RECORDING: 'recording',
  UPLOADING: 'uploading',
  SUBMITTED: 'submitted',
  REVIEW_REQUIRED: 'review_required',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUPERSEDED: 'superseded',
  ABORTED: 'aborted',
});

// mission_records.evidence_kind
export const RecordEvidenceKind = Object.freeze({
  CAMERA_MEDIA: 'camera_media',
  SENSOR_RAW: 'sensor_raw',
  SENSOR_SUMMARY: 'sensor_summary',
});

// media_files.media_kind
export const MediaKind = Object.freeze({
  CAMERA_PHOTO: 'camera_photo',
  CAMERA_VIDEO: 'camera_video',
  SENSOR_RAW: 'sensor_raw',
});

// media_files.upload_status
export const UploadStatus = Object.freeze({
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
  DELETING: 'deleting',
  DELETED: 'deleted',
});

// verification_results.decision
export const Decision = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVIEW_REQUIRED: 'review_required',
});

// verification_results.source
export const DecisionSource = Object.freeze({
  AI: 'ai',
  ADMIN: 'admin',
});

// verification_appeals.status
export const VerificationAppealStatus = Object.freeze({
  OPEN: 'open',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

// point_transactions.kind
export const PointTransactionKind = Object.freeze({
  AUTO_AWARD: 'auto_award',
  SPEND: 'spend',
  REFUND: 'refund',
  MANUAL_GRANT: 'manual_grant',
  MANUAL_RECOVERY: 'manual_recovery',
  RECOVERY: 'recovery',
  RECOVERY_CLAIM: 'recovery_claim',
  RECOVERY_SETTLEMENT: 'recovery_settlement',
  RECOVERY_CANCEL: 'recovery_cancel',
  REINSTATEMENT: 'reinstatement',
  AWARD_OFFSET: 'award_offset',
  REFUND_OFFSET: 'refund_offset',
});

// point_transactions.source_type
export const PointSourceType = Object.freeze({
  MISSION: 'mission',
  STREAK: 'streak',
  ACHIEVEMENT: 'achievement',
  CHALLENGE: 'challenge',
  SHOP_ORDER: 'shop_order',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
});

// streak_days.status
export const StreakDayStatus = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
});

// achievement_versions.rarity
export const AchievementRarity = Object.freeze({
  COMMON: 'common',
  RARE: 'rare',
  LEGENDARY: 'legendary',
});

// pet_stage_versions.stage_code
export const PetStageCode = Object.freeze({
  EGG: 'egg',
  BABY: 'baby',
  ADULT: 'adult',
});

// shop_items.item_kind
export const ShopItemKind = Object.freeze({
  CONSUMABLE: 'consumable',
  PERMANENT: 'permanent',
});

// shop_orders.status
export const ShopOrderStatus = Object.freeze({
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

// challenges.publication_status
export const ChallengePublicationStatus = Object.freeze({
  DRAFT: 'draft',
  REVIEW_PENDING: 'review_pending',
  PUBLIC: 'public',
  REJECTED: 'rejected',
  HIDDEN: 'hidden',
  CANCELLED: 'cancelled',
});

// challenges.settlement_status
export const ChallengeSettlementStatus = Object.freeze({
  NOT_STARTED: 'not_started',
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
});

// challenge_participations.status
export const ChallengeParticipationStatus = Object.freeze({
  ENROLLED: 'enrolled',
  WITHDRAWN: 'withdrawn',
  DISQUALIFIED: 'disqualified',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

// challenge_daily_missions.status
export const ChallengeDailyMissionStatus = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  EXCLUDED: 'excluded',
  CANCELLED: 'cancelled',
});

// users.status
export const UserStatus = Object.freeze({
  ACTIVE: 'active',
  WITHDRAWAL_PROCESSING: 'withdrawal_processing',
});

// account_actions.action_type
export const AccountActionType = Object.freeze({
  WARNING: 'warning',
  RESTRICTION: 'restriction',
});

// account_withdrawal_requests.status
export const WithdrawalRequestStatus = Object.freeze({
  REQUESTED: 'requested',
  CANCELLED: 'cancelled',
  ON_HOLD: 'on_hold',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
});

// support_tickets.ticket_type
export const TicketType = Object.freeze({
  INQUIRY: 'inquiry',
  REPORT: 'report',
});

// support_tickets.status
export const TicketStatus = Object.freeze({
  RECEIVED: 'received',
  IN_REVIEW: 'in_review',
  COMPLETED: 'completed',
});

// support_tickets.target_kind
export const TicketTargetKind = Object.freeze({
  USER: 'user',
  MISSION_DEFINITION: 'mission_definition',
  CHALLENGE: 'challenge',
});

// support_ticket_resolutions.outcome
export const TicketResolutionOutcome = Object.freeze({
  NO_ACTION: 'no_action',
  REPLY_ONLY: 'reply_only',
  ACCOUNT_ACTION: 'account_action',
  CONTENT_ACTION: 'content_action',
  BOTH: 'both',
});

// notices.category
export const NoticeCategory = Object.freeze({
  SERVICE: 'service',
  EVENT: 'event',
  POLICY: 'policy',
  MARKETING: 'marketing',
});

// notices.status
export const NoticeStatus = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
});

// user_notifications.push_status
export const PushStatus = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

// ai_analysis_runs.run_type
export const AiRunType = Object.freeze({
  PLAN_ADJUSTMENT: 'plan_adjustment',
  SITUATIONAL_RECOMMENDATION: 'situational_recommendation',
  WEEKLY_REPORT: 'weekly_report',
  MONTHLY_REPORT: 'monthly_report',
});

// ai_mission_recommendations.status
export const AiRecommendationStatus = Object.freeze({
  SHOWN: 'shown',
  ACCEPTED: 'accepted',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
});

// recommendation_messages.condition_type
export const RecommendationConditionType = Object.freeze({
  ALWAYS: 'always',
  NO_MISSION_TODAY: 'no_mission_today',
  STREAK_AT_RISK: 'streak_at_risk',
  INACTIVE_DAYS: 'inactive_days',
  TIME_SLOT: 'time_slot',
});

// labels.js key (camelCase field name) -> enum object. Used by tests and by generic screens.
export const statusEnums = Object.freeze({
  goalStatus: GoalStatus,
  goalStepStatus: GoalStepStatus,
  missionStatus: MissionStatus,
  missionSourceType: MissionSourceType,
  missionCancelReason: MissionCancelReason,
  missionDefinitionPublicationStatus: MissionDefinitionPublicationStatus,
  aiPlanProposalStatus: AiPlanProposalStatus,
  planAdjustmentProposalStatus: PlanAdjustmentProposalStatus,
  recordStatus: RecordStatus,
  recordEvidenceKind: RecordEvidenceKind,
  mediaKind: MediaKind,
  uploadStatus: UploadStatus,
  decision: Decision,
  decisionSource: DecisionSource,
  verificationAppealStatus: VerificationAppealStatus,
  pointTransactionKind: PointTransactionKind,
  pointSourceType: PointSourceType,
  streakDayStatus: StreakDayStatus,
  achievementRarity: AchievementRarity,
  petStageCode: PetStageCode,
  shopItemKind: ShopItemKind,
  shopOrderStatus: ShopOrderStatus,
  challengePublicationStatus: ChallengePublicationStatus,
  challengeSettlementStatus: ChallengeSettlementStatus,
  challengeParticipationStatus: ChallengeParticipationStatus,
  challengeDailyMissionStatus: ChallengeDailyMissionStatus,
  userStatus: UserStatus,
  accountActionType: AccountActionType,
  withdrawalRequestStatus: WithdrawalRequestStatus,
  ticketType: TicketType,
  ticketStatus: TicketStatus,
  ticketTargetKind: TicketTargetKind,
  ticketResolutionOutcome: TicketResolutionOutcome,
  noticeCategory: NoticeCategory,
  noticeStatus: NoticeStatus,
  pushStatus: PushStatus,
  aiRunType: AiRunType,
  aiRecommendationStatus: AiRecommendationStatus,
  recommendationConditionType: RecommendationConditionType,
});
