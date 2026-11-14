/**
 * 로그인한 뒤 보이는 하단 탭 다섯 개.
 *
 * 홈 · 목표 · 챌린지 · 리포트 · 마이 순이고, 각 탭은 자기 화면 묶음을 갖는다.
 * 미션 관리는 홈의 "관리"에서 연다 (HomeStack).
 * 탭 아이콘은 선으로 그린 아이콘이며 선택된 탭만 색이 들어온다.
 * 탭 막대는 시스템 내비게이션 막대(제스처 바)만큼 아래 여백을 더 둔다.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Routes from './routes';
import Icon from '../components/Icon';
import ChallengesStack from './stacks/ChallengesStack';
import GoalsStack from './stacks/GoalsStack';
import HomeStack from './stacks/HomeStack';
import MyStack from './stacks/MyStack';
import ReportsStack from './stacks/ReportsStack';
import { colors, typography } from '../theme';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: Routes.HOME_TAB, component: HomeStack, label: '홈', icon: 'home' },
  { name: Routes.GOALS_TAB, component: GoalsStack, label: '목표', icon: 'flag' },
  { name: Routes.CHALLENGES_TAB, component: ChallengesStack, label: '챌린지', icon: 'trophy' },
  { name: Routes.REPORTS_TAB, component: ReportsStack, label: '리포트', icon: 'chart' },
  { name: Routes.MY_TAB, component: MyStack, label: '마이', icon: 'user' },
];

const renderIcon =
  (name) =>
  ({ color }) => <Icon name={name} size={22} color={color} />;

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarLabelStyle: typography.caption,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
      }}>
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label, tabBarIcon: renderIcon(tab.icon) }}
        />
      ))}
    </Tab.Navigator>
  );
}
