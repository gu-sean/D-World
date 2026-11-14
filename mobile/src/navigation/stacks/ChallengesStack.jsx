/**
 * 챌린지 탭의 화면 묶음.
 *
 * 관리자가 만든 챌린지 목록에서 시작해 내 챌린지로 간다. 챌린지 상세·랭킹·결과는
 * 탭 위에 쌓이는 루트 스택의 화면이라 여기에 넣지 않는다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import ChallengeHomeScreen from '../../screens/challenges/ChallengeHomeScreen';
import MyChallengesScreen from '../../screens/challenges/MyChallengesScreen';

const Stack = createNativeStackNavigator();

export default function ChallengesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.CHALLENGE_HOME} component={ChallengeHomeScreen} />
      <Stack.Screen name={Routes.MY_CHALLENGES} component={MyChallengesScreen} />
    </Stack.Navigator>
  );
}
