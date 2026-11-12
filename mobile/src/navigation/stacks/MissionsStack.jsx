/**
 * 미션 탭의 화면 묶음.
 *
 * 날짜별 미션 관리에서 시작해, 미션 틀 고르기와 직접 만들기·수정으로 간다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import MissionManageScreen from '../../screens/missions/MissionManageScreen';
import MissionCatalogScreen from '../../screens/missions/MissionCatalogScreen';
import MissionFormScreen from '../../screens/missions/MissionFormScreen';

const Stack = createNativeStackNavigator();

export default function MissionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.MISSION_MANAGE} component={MissionManageScreen} />
      <Stack.Screen name={Routes.MISSION_CATALOG} component={MissionCatalogScreen} />
      <Stack.Screen name={Routes.MISSION_FORM} component={MissionFormScreen} />
    </Stack.Navigator>
  );
}
