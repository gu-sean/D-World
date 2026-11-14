/**
 * 기능 모듈 공개 목록 (parts/mobile-client.md §4.2 표).
 *
 * **화면(최정훈)은 여기 있는 것만 쓴다.** 안쪽 파일을 바로 import 하지 않는다.
 * 여기에 없는 기능이 필요하면 이슈로 요청한다 — 이 파일은 01 §2의 공용 파일이다.
 *
 * 훅 모양 규칙 (§4.1)
 *  - 조회 훅: TanStack Query 결과 그대로 (`data`, `isLoading`, `isError`, `error`, `refetch`).
 *    무한 목록은 `fetchNextPage`·`hasNextPage`에 더해 `items`(펼친 배열)도 함께 준다.
 *  - 변경 훅: `useMutation` 결과 + `retry()`. `m.mutate(input, {onSuccess})`.
 *  - 모든 훅의 `error`는 `AppError`다 — `error.code`로 분기하고 `error.message`를 그대로 보여 준다.
 */

// ── 앱 전체 감싸기 ───────────────────────────────────────────────────
export { ClientProvider } from '../setup/ClientProvider.js';

// ── 세션·계정 (A01~A14) ──────────────────────────────────────────────
export {
  useSession,
  useRequestPhoneVerification,
  useNicknameAvailability,
  useCurrentPolicies,
  useSignup,
  useLogin,
  useSocialLogin,
  useResetPassword,
  useLogout,
} from './queries/auth.js';

export {
  useMe,
  useUpdateProfile,
  useSubmitConsents,
  useRequestWithdrawal,
} from './queries/me.js';

// ── 기준 데이터 (A17~A19) ────────────────────────────────────────────
export {
  useGoalCategories,
  useDifficultyLevels,
  useExerciseTypes,
} from './queries/catalog.js';

// ── 목표·계획 (A20~A28) ──────────────────────────────────────────────
export {
  useGoals,
  useGoal,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGeneratePlan,
  useLatestPlan,
  useAcceptPlan,
  useRejectPlan,
} from './queries/goals.js';

// ── 홈 (A29) ─────────────────────────────────────────────────────────
export { useHome } from './queries/home.js';

// ── 미션 (A30~A36) ───────────────────────────────────────────────────
export {
  useMissions,
  useMission,
  useCreateMission,
  useUpdateMission,
  useCancelMission,
  useMissionDefinitions,
  useNextMissions,
  useDifficultyPreview,
  useGoalGaps,
  useFillGoalGaps,
} from './queries/missions.js';

// ── 수행 인증 (A40~A46) ──────────────────────────────────────────────
export { useCameraVerification } from './flows/cameraVerification.js';
export { useRunSession } from './flows/runSession.js';
export { useRecord, useAbortRecord, useAppeal } from './queries/records.js';

// ── 계획 재조정 (A50~A53) ────────────────────────────────────────────
export {
  usePlanAdjustments,
  usePlanAdjustment,
  useAcceptAdjustment,
  useRejectAdjustment,
} from './queries/adjustments.js';

// ── 리포트 (A60~A64) ─────────────────────────────────────────────────
export {
  useReportSummary,
  useAiReports,
  useAiReport,
  useMarkAiReportRead,
  useCalendar,
} from './queries/reports.js';

// ── 포인트·상점·스트릭·업적 (A70~A77) ────────────────────────────────
export {
  useShopItems,
  useCreateShopOrder,
  useInventory,
  usePoints,
  usePointTransactions,
  useStreak,
  useAchievements,
  useSetRepresentativeBadge,
} from './queries/rewards.js';

// ── 펫 (A80~A85) ─────────────────────────────────────────────────────
export {
  useMyPets,
  usePetSpecies,
  usePetSpeciesDetail,
  useSetRepresentativePet,
  useHatchPet,
  usePetEvolutionEvents,
} from './queries/pets.js';

// ── 상황 추천 (A90~A93) ──────────────────────────────────────────────
export {
  useSituationalRecommendations,
  useAcceptRecommendation,
  useDismissRecommendation,
  useActiveRecommendations,
} from './queries/recommendations.js';

// ── 챌린지 (A100~A107) ───────────────────────────────────────────────
export {
  useChallenges,
  useChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  useMyChallenges,
  useChallengeRanking,
  useChallengeResult,
} from './queries/challenges.js';

// ── 알림·공지 (A110~A114) ────────────────────────────────────────────
export {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotices,
  useNotice,
} from './queries/notifications.js';

// ── 문의·구독 (A120~A122, A130) ──────────────────────────────────────
export {
  useCreateSupportTicket,
  useMySupportTickets,
  useSupportTicket,
  useSubscription,
} from './queries/support.js';

// ── 훅이 아닌 도구 ───────────────────────────────────────────────────
/** 입력 검사 모음. 각 함수는 `{ok, message?}` (11 §8) */
export { validators } from './validation/rules.js';
/** 화면 표시 서식 모음 (04 §6) */
export { format } from './format/format.js';
/** 상태값 → 한국어 문구 (04 §5). `labels.missionStatus.completed === '완료'` */
export { labels, labelOf } from './labels.js';
/** 알림·공지의 `linkScreen` → `{name, params}` (07 §17) */
export { parseLinkScreen } from './links.js';
/** 권한 `check`·`request`·`openSettings` (parts/mobile-ui §8) */
export { permissions } from './device/permissions.js';
/** `.env`에서 읽은 설정값 (12 §8.4). 비밀값은 들어 있지 않다. */
export { config, isDev } from './config.js';
/** 앱 안의 유일한 오류 모양 (05 §7) */
export { AppError } from './http/AppError.js';
export { getErrorMessage } from './http/errorMessages.js';
