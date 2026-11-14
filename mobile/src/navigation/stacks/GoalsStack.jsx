/**
 * 목표 탭의 화면 묶음.
 *
 * 목표 보드에서 시작해 목록·상세·등록으로 가고, 거기서 AI 계획 만들기
 * (만드는 중 → 제안 → 수락 결과)로 이어진다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import GoalBoardScreen from '../../screens/goals/GoalBoardScreen';
import GoalListScreen from '../../screens/goals/GoalListScreen';
import GoalDetailScreen from '../../screens/goals/GoalDetailScreen';
import GoalFormScreen from '../../screens/goals/GoalFormScreen';
import PlanGeneratingScreen from '../../screens/goals/PlanGeneratingScreen';
import PlanProposalScreen from '../../screens/goals/PlanProposalScreen';
import PlanMissionsScreen from '../../screens/goals/PlanMissionsScreen';
// 목표 상세에서 세부 미션을 더하거나 고친 뒤 목표 상세로 돌아오도록 목표 탭에도 둔다
import MissionCatalogScreen from '../../screens/missions/MissionCatalogScreen';
import MissionFormScreen from '../../screens/missions/MissionFormScreen';

const Stack = createNativeStackNavigator();

export default function GoalsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.GOAL_BOARD} component={GoalBoardScreen} />
      <Stack.Screen name={Routes.GOAL_LIST} component={GoalListScreen} />
      <Stack.Screen name={Routes.GOAL_DETAIL} component={GoalDetailScreen} />
      <Stack.Screen name={Routes.GOAL_FORM} component={GoalFormScreen} />
      <Stack.Screen name={Routes.PLAN_GENERATING} component={PlanGeneratingScreen} />
      <Stack.Screen name={Routes.PLAN_PROPOSAL} component={PlanProposalScreen} />
      <Stack.Screen name={Routes.PLAN_MISSIONS} component={PlanMissionsScreen} />
      <Stack.Screen name={Routes.MISSION_FORM} component={MissionFormScreen} />
      <Stack.Screen name={Routes.MISSION_CATALOG} component={MissionCatalogScreen} />
    </Stack.Navigator>
  );
}
