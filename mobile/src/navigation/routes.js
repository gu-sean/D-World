/**
 * 화면 이름 상수.
 *
 * 화면 이동은 언제나 `navigation.navigate(Routes.X, params)` 로 한다.
 * 화면 파일끼리 직접 import 하지 않기 때문에, 어떤 화면이 어디서 열리는지는
 * 이 표와 각 스택 파일만 보면 알 수 있다.
 *
 * 파라미터는 **ID만** 넘긴다. 받은 화면이 훅으로 다시 조회하므로 목록에서 상세로
 * 넘어갈 때 오래된 값이 따라가지 않는다.
 */
export const Routes = Object.freeze({
  // 시작
  SPLASH: 'Splash',

  // 로그인·가입
  LOGIN: 'Login',
  SIGNUP_METHOD: 'SignupMethod',
  SOCIAL_SIGNUP_CONFIRM: 'SocialSignupConfirm', // { provider, email, socialSignupToken }
  TERMS_AGREEMENT: 'TermsAgreement',            // { purpose: 'phone'|'social', socialSignupToken? }
  PHONE_NUMBER: 'PhoneNumber',                  // { purpose: 'signup'|'reset_password', consents? }
  OTP_VERIFY: 'OtpVerify',                      // { purpose, verificationId, phoneNumber, expiresAt, resendAvailableAt, consents? }
  PASSWORD_SETUP: 'PasswordSetup',              // { mode: 'signup'|'reset', verificationToken, consents? }
  NICKNAME_SETUP: 'NicknameSetup',              // { verificationToken, password, consents } 또는 { socialSignupToken, consents }
  SIGNUP_COMPLETE: 'SignupComplete',
  EXISTING_ACCOUNT: 'ExistingAccount',          // { kind: 'phone'|'social', provider? }
  SOCIAL_AUTH_ERROR: 'SocialAuthError',         // { kind: 'cancelled'|'failed', provider? }
  PASSWORD_CHANGED: 'PasswordChanged',
  SOCIAL_RECOVERY_GUIDE: 'SocialRecoveryGuide', // { provider }
  RESET_ACCOUNT_NOT_FOUND: 'ResetAccountNotFound',

  // 하단 탭
  MAIN: 'Main',                                 // 탭 묶음 자체 (탭 밖에서 홈으로 돌아올 때)
  HOME_TAB: 'HomeTab',
  GOALS_TAB: 'GoalsTab',
  MISSIONS_TAB: 'MissionsTab',
  REPORTS_TAB: 'ReportsTab',
  MY_TAB: 'MyTab',

  // 홈
  HOME: 'Home',

  // 목표·계획
  GOAL_BOARD: 'GoalBoard',
  GOAL_LIST: 'GoalList',                        // { status? }
  GOAL_DETAIL: 'GoalDetail',                    // { goalId }
  GOAL_FORM: 'GoalForm',                        // { goalId? } 없으면 등록
  PLAN_GENERATING: 'PlanGenerating',            // { goalId }
  PLAN_PROPOSAL: 'PlanProposal',                // { goalId }
  PLAN_MISSIONS: 'PlanMissions',                // { goalId, createdMissionCount, todayMissions }

  // 미션
  MISSION_MANAGE: 'MissionManage',
  MISSION_CATALOG: 'MissionCatalog',            // { goalId?, date? }
  MISSION_FORM: 'MissionForm',                  // { missionId?, goalId?, date? }
  MISSION_DETAIL: 'MissionDetail',              // { missionId }
  MISSION_COMPLETE: 'MissionComplete',          // { recordId }
  NEXT_MISSION: 'NextMission',

  // 수행 인증
  VERIFY_PERMISSION: 'VerifyPermission',        // { missionId, kind: 'camera'|'location' }
  VERIFY_GUIDE: 'VerifyGuide',                  // { missionId }
  VERIFY_ANALYZING: 'VerifyAnalyzing',          // { missionId }
  VERIFY_RESULT: 'VerifyResult',                // { recordId }
  VERIFY_RETRY_GUIDE: 'VerifyRetryGuide',       // { missionId, recordId }
  RUN_TRACKING: 'RunTracking',                  // { missionId }

  // 계획 재조정
  PLAN_ADJUST_REASON: 'PlanAdjustReason',       // { adjustmentId }
  PLAN_ADJUST_PROPOSAL: 'PlanAdjustProposal',   // { adjustmentId }
  PLAN_ADJUST_COMPARE: 'PlanAdjustCompare',     // { adjustmentId }
  PLAN_ADJUST_EDIT: 'PlanAdjustEdit',           // { adjustmentId }
  PLAN_ADJUST_CONFIRM: 'PlanAdjustConfirm',     // { adjustmentId, plan? }
  PLAN_ADJUST_RESULT: 'PlanAdjustResult',       // { adjustmentId, goalId }
  PLAN_ADJUST_HISTORY: 'PlanAdjustHistory',
  PLAN_ADJUST_HISTORY_DETAIL: 'PlanAdjustHistoryDetail', // { adjustmentId }

  // 리포트
  REPORT: 'Report',
  MONTHLY_CALENDAR: 'MonthlyCalendar',          // { month? }
  AI_REPORT_DETAIL: 'AiReportDetail',           // { runId }

  // 상황 추천
  CONTEXT_SETTINGS: 'ContextSettings',
  LOCATION_PERMISSION: 'LocationPermission',    // { next: kind }
  LOCATION_STATUS: 'LocationStatus',
  SITUATION_RECOMMEND: 'SituationRecommend',    // { kind: 'location'|'moving'|'weather' }
  RECOMMENDATION_DETAIL: 'RecommendationDetail',// { recommendationId }
  RECOMMENDATION_FEEDBACK: 'RecommendationFeedback', // { recommendationId }

  // 펫
  PET_ROOM: 'PetRoom',
  PET_COLLECTION: 'PetCollection',
  PET_DETAIL: 'PetDetail',                      // { speciesId }
  PET_HATCH: 'PetHatch',                        // { speciesId? }

  // 보상
  STREAK: 'Streak',
  ACHIEVEMENT_LIST: 'AchievementList',
  POINT_HISTORY: 'PointHistory',
  SHOP: 'Shop',

  // 챌린지
  CHALLENGE_EXPLORE: 'ChallengeExplore',
  CHALLENGE_DETAIL: 'ChallengeDetail',          // { challengeId }
  MY_CHALLENGES: 'MyChallenges',
  CHALLENGE_RANKING: 'ChallengeRanking',        // { challengeId }
  CHALLENGE_RESULT: 'ChallengeResult',          // { challengeId }
  CHALLENGE_CREATE: 'ChallengeCreate',

  // 마이
  MY: 'My',
  PROFILE_EDIT: 'ProfileEdit',
  RECONSENT: 'Reconsent',                       // 로그인 뒤 약관 재동의 (A13)
  NOTIFICATION_INBOX: 'NotificationInbox',
  NOTICE_LIST: 'NoticeList',
  NOTICE_DETAIL: 'NoticeDetail',                // { noticeId }
  SUPPORT_TICKET_LIST: 'SupportTicketList',
  SUPPORT_TICKET_FORM: 'SupportTicketForm',     // { ticketType, targetKind?, targetId? }
  SUPPORT_TICKET_DETAIL: 'SupportTicketDetail', // { ticketId }
  SETTINGS: 'Settings',
  WITHDRAWAL: 'Withdrawal',
  SUBSCRIPTION: 'Subscription',

  // 모달
  PET_EVOLUTION_MODAL: 'PetEvolutionModal',     // { petId, since? }
  ACHIEVEMENT_EARNED_MODAL: 'AchievementEarnedModal', // { badges }
  SURPRISE_MISSION_MODAL: 'SurpriseMissionModal',
});

export default Routes;
