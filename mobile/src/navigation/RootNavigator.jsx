/**
 * 앱 전체의 화면 흐름을 정하는 가장 바깥 내비게이터.
 *
 * 세션 상태에 따라 보여 주는 묶음이 통째로 바뀐다.
 *   restoring  스플래시 (저장된 토큰으로 로그인을 되살리는 동안)
 *   signedOut  로그인·가입 화면
 *   signedIn   하단 탭 + 탭 위에 쌓이는 화면들
 *
 * 탭 위에 쌓는 화면은 어느 탭에서든 열 수 있어야 하는 것들이다 — 미션 상세,
 * 수행 인증, 계획 재조정, 상황 추천, 챌린지 상세. 모달 세 개는 아래에서 올라온다.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import Routes from './routes';
import navigationRef from './navigationRef';
import { useSession } from '../client';
import SplashScreen from '../screens/common/SplashScreen';
import SignupCompleteScreen from '../screens/auth/SignupCompleteScreen';

import MissionDetailScreen from '../screens/missions/MissionDetailScreen';
import MissionCompleteScreen from '../screens/missions/MissionCompleteScreen';
import NextMissionScreen from '../screens/missions/NextMissionScreen';

import VerifyPermissionScreen from '../screens/verification/VerifyPermissionScreen';
import VerifyGuideScreen from '../screens/verification/VerifyGuideScreen';
import VerifyAnalyzingScreen from '../screens/verification/VerifyAnalyzingScreen';
import VerifyResultScreen from '../screens/verification/VerifyResultScreen';
import VerifyRetryGuideScreen from '../screens/verification/VerifyRetryGuideScreen';
import RunTrackingScreen from '../screens/verification/RunTrackingScreen';

import PlanAdjustReasonScreen from '../screens/planAdjustments/PlanAdjustReasonScreen';
import PlanAdjustProposalScreen from '../screens/planAdjustments/PlanAdjustProposalScreen';
import PlanAdjustCompareScreen from '../screens/planAdjustments/PlanAdjustCompareScreen';
import PlanAdjustEditScreen from '../screens/planAdjustments/PlanAdjustEditScreen';
import PlanAdjustConfirmScreen from '../screens/planAdjustments/PlanAdjustConfirmScreen';
import PlanAdjustResultScreen from '../screens/planAdjustments/PlanAdjustResultScreen';
import PlanAdjustHistoryScreen from '../screens/planAdjustments/PlanAdjustHistoryScreen';
import PlanAdjustHistoryDetailScreen from '../screens/planAdjustments/PlanAdjustHistoryDetailScreen';

import ContextSettingsScreen from '../screens/recommendations/ContextSettingsScreen';
import LocationPermissionScreen from '../screens/recommendations/LocationPermissionScreen';
import LocationStatusScreen from '../screens/recommendations/LocationStatusScreen';
import SituationRecommendScreen from '../screens/recommendations/SituationRecommendScreen';
import RecommendationDetailScreen from '../screens/recommendations/RecommendationDetailScreen';
import RecommendationFeedbackScreen from '../screens/recommendations/RecommendationFeedbackScreen';
import SurpriseMissionModal from '../screens/recommendations/SurpriseMissionModal';

import ChallengeDetailScreen from '../screens/challenges/ChallengeDetailScreen';
import ChallengeRankingScreen from '../screens/challenges/ChallengeRankingScreen';
import ChallengeResultScreen from '../screens/challenges/ChallengeResultScreen';

import PetEvolutionModal from '../screens/pets/PetEvolutionModal';
import AchievementEarnedModal from '../screens/rewards/AchievementEarnedModal';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { status } = useSession();

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'restoring' && (
          <Stack.Screen name={Routes.SPLASH} component={SplashScreen} />
        )}

        {status === 'signedOut' && (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}

        {status === 'signedIn' && (
          <Stack.Group>
            <Stack.Screen name={Routes.MAIN} component={MainTabs} />

            {/* 가입 직후에만 들르는 화면. 세션이 열린 뒤라 여기에 있다. */}
            <Stack.Screen name={Routes.SIGNUP_COMPLETE} component={SignupCompleteScreen} />

            <Stack.Screen name={Routes.MISSION_DETAIL} component={MissionDetailScreen} />
            <Stack.Screen name={Routes.MISSION_COMPLETE} component={MissionCompleteScreen} />
            <Stack.Screen name={Routes.NEXT_MISSION} component={NextMissionScreen} />

            <Stack.Screen name={Routes.VERIFY_PERMISSION} component={VerifyPermissionScreen} />
            <Stack.Screen name={Routes.VERIFY_GUIDE} component={VerifyGuideScreen} />
            <Stack.Screen name={Routes.VERIFY_ANALYZING} component={VerifyAnalyzingScreen} />
            <Stack.Screen name={Routes.VERIFY_RESULT} component={VerifyResultScreen} />
            <Stack.Screen name={Routes.VERIFY_RETRY_GUIDE} component={VerifyRetryGuideScreen} />
            <Stack.Screen name={Routes.RUN_TRACKING} component={RunTrackingScreen} />

            <Stack.Screen name={Routes.PLAN_ADJUST_REASON} component={PlanAdjustReasonScreen} />
            <Stack.Screen name={Routes.PLAN_ADJUST_PROPOSAL} component={PlanAdjustProposalScreen} />
            <Stack.Screen name={Routes.PLAN_ADJUST_COMPARE} component={PlanAdjustCompareScreen} />
            <Stack.Screen name={Routes.PLAN_ADJUST_EDIT} component={PlanAdjustEditScreen} />
            <Stack.Screen name={Routes.PLAN_ADJUST_CONFIRM} component={PlanAdjustConfirmScreen} />
            <Stack.Screen name={Routes.PLAN_ADJUST_RESULT} component={PlanAdjustResultScreen} />
            <Stack.Screen name={Routes.PLAN_ADJUST_HISTORY} component={PlanAdjustHistoryScreen} />
            <Stack.Screen
              name={Routes.PLAN_ADJUST_HISTORY_DETAIL}
              component={PlanAdjustHistoryDetailScreen}
            />

            <Stack.Screen name={Routes.CONTEXT_SETTINGS} component={ContextSettingsScreen} />
            <Stack.Screen name={Routes.LOCATION_PERMISSION} component={LocationPermissionScreen} />
            <Stack.Screen name={Routes.LOCATION_STATUS} component={LocationStatusScreen} />
            <Stack.Screen name={Routes.SITUATION_RECOMMEND} component={SituationRecommendScreen} />
            <Stack.Screen
              name={Routes.RECOMMENDATION_DETAIL}
              component={RecommendationDetailScreen}
            />
            <Stack.Screen
              name={Routes.RECOMMENDATION_FEEDBACK}
              component={RecommendationFeedbackScreen}
            />

            <Stack.Screen name={Routes.CHALLENGE_DETAIL} component={ChallengeDetailScreen} />
            <Stack.Screen name={Routes.CHALLENGE_RANKING} component={ChallengeRankingScreen} />
            <Stack.Screen name={Routes.CHALLENGE_RESULT} component={ChallengeResultScreen} />

            <Stack.Group screenOptions={{ presentation: 'transparentModal', animation: 'fade' }}>
              <Stack.Screen name={Routes.PET_EVOLUTION_MODAL} component={PetEvolutionModal} />
              <Stack.Screen
                name={Routes.ACHIEVEMENT_EARNED_MODAL}
                component={AchievementEarnedModal}
              />
              <Stack.Screen
                name={Routes.SURPRISE_MISSION_MODAL}
                component={SurpriseMissionModal}
              />
            </Stack.Group>
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
