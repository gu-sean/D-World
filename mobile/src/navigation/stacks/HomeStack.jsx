/**
 * 홈 탭의 화면 묶음.
 *
 * 홈과, 홈의 "관리"에서 여는 미션 관리(날짜별 미션 → 미션 틀 고르기·직접 만들기)가 들어 있다.
 * 홈에서 여는 미션 상세·인증·추천은 탭 위에 쌓이는 루트 스택의 화면이라 여기에 넣지 않는다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import HomeScreen from '../../screens/home/HomeScreen';
import MissionManageScreen from '../../screens/missions/MissionManageScreen';
import MissionCatalogScreen from '../../screens/missions/MissionCatalogScreen';
import MissionFormScreen from '../../screens/missions/MissionFormScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.HOME} component={HomeScreen} />
      <Stack.Screen name={Routes.MISSION_MANAGE} component={MissionManageScreen} />
      <Stack.Screen name={Routes.MISSION_CATALOG} component={MissionCatalogScreen} />
      <Stack.Screen name={Routes.MISSION_FORM} component={MissionFormScreen} />
    </Stack.Navigator>
  );
}
