import test from 'node:test';
import assert from 'node:assert/strict';

import { resetTestEnv } from './helpers/fakeModules.js';
import * as client from '../src/client/index.js';

/**
 * parts/mobile-client.md §4.2 "공개 목록" 표 그대로.
 * 화면(최정훈)과의 계약이므로, 여기가 바뀌면 문서도 같이 바꾼다.
 */
const PUBLIC_API = [
  'ClientProvider',
  'useSession',
  'useRequestPhoneVerification',
  'useConfirmPhoneVerification',
  'useNicknameAvailability',
  'useCurrentPolicies',
  'useSignup',
  'useLogin',
  'useSocialLogin',
  'useResetPassword',
  'useLogout',
  'useMe',
  'useUpdateProfile',
  'useSubmitConsents',
  'useRequestWithdrawal',
  'useGoalCategories',
  'useDifficultyLevels',
  'useExerciseTypes',
  'useCreateGoal',
  'useGoals',
  'useUpdateGoal',
  'useDeleteGoal',
  'useGoal',
  'useGeneratePlan',
  'useLatestPlan',
  'useAcceptPlan',
  'useRejectPlan',
  'useHome',
  'useMissions',
  'useCreateMission',
  'useUpdateMission',
  'useCancelMission',
  'useMission',
  'useMissionDefinitions',
  'useNextMissions',
  'useCameraVerification',
  'useRunSession',
  'useRecord',
  'useAbortRecord',
  'useAppeal',
  'usePlanAdjustments',
  'usePlanAdjustment',
  'useAcceptAdjustment',
  'useRejectAdjustment',
  'useReportSummary',
  'useAiReports',
  'useAiReport',
  'useMarkAiReportRead',
  'useCalendar',
  'useShopItems',
  'useCreateShopOrder',
  'useInventory',
  'usePoints',
  'usePointTransactions',
  'useStreak',
  'useAchievements',
  'useSetRepresentativeBadge',
  'useMyPets',
  'usePetSpecies',
  'usePetSpeciesDetail',
  'useSetRepresentativePet',
  'useHatchPet',
  'usePetEvolutionEvents',
  'useSituationalRecommendations',
  'useAcceptRecommendation',
  'useDismissRecommendation',
  'useActiveRecommendations',
  'useChallenges',
  'useChallenge',
  'useJoinChallenge',
  'useLeaveChallenge',
  'useCreateChallenge',
  'useMyChallenges',
  'useChallengeRanking',
  'useChallengeResult',
  'useNotifications',
  'useMarkNotificationRead',
  'useMarkAllNotificationsRead',
  'useNotices',
  'useNotice',
  'useCreateSupportTicket',
  'useMySupportTickets',
  'useSupportTicket',
  'useSubscription',
  'validators',
  'format',
  'labels',
  'parseLinkScreen',
  'permissions',
  'AppError',
  'getErrorMessage',
  // 표에는 `labels`만 적혀 있지만, 모르는 값까지 안전하게 바꾸는 짝 함수를 함께 내보낸다.
  'labelOf',
];

test('§4.2 표의 모든 이름을 내보낸다', () => {
  resetTestEnv();
  for (const name of PUBLIC_API) {
    assert.notEqual(client[name], undefined, `${name}을(를) 내보내지 않았어요`);
  }
});

test('표에 없는 것을 몰래 더 내보내지 않는다', () => {
  const exported = Object.keys(client).filter((k) => k !== 'default');
  assert.deepEqual(exported.sort(), [...PUBLIC_API].sort());
});

test('훅은 함수, 도구는 객체', () => {
  for (const name of PUBLIC_API) {
    if (name.startsWith('use') || name === 'parseLinkScreen' || name === 'getErrorMessage' || name === 'labelOf') {
      assert.equal(typeof client[name], 'function', name);
    }
  }
  for (const name of ['validators', 'format', 'labels', 'permissions']) {
    assert.equal(typeof client[name], 'object', name);
  }
  assert.equal(typeof client.AppError, 'function');
  assert.equal(typeof client.ClientProvider, 'function');
});

test('§4.2에 적힌 사용 예가 그대로 동작한다', () => {
  assert.equal(client.labels.missionStatus.completed, '완료');
  assert.deepEqual(client.parseLinkScreen('missions/m1'), { name: 'missionDetail', params: { missionId: 'm1' } });
  assert.equal(client.validators.validatePassword('short').ok, false);
  assert.equal(client.format.formatPoints(1250), '1,250P');
  assert.equal(client.getErrorMessage('COMMON_NOT_FOUND'), '찾을 수 없어요.');
  assert.equal(typeof client.permissions.check, 'function');
  assert.equal(typeof client.permissions.request, 'function');
  assert.equal(typeof client.permissions.openSettings, 'function');
});
