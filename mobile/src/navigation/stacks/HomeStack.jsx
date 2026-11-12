/**
 * 홈 탭의 화면 묶음.
 *
 * 홈 한 장뿐이다. 홈에서 여는 미션 상세·인증·추천은 탭 위에 쌓이는
 * 루트 스택의 화면이라 여기에 넣지 않는다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import HomeScreen from '../../screens/home/HomeScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.HOME} component={HomeScreen} />
    </Stack.Navigator>
  );
}
