/**
 * 로그인한 뒤 보이는 하단 탭 다섯 개.
 *
 * 홈 · 목표 · 미션 · 리포트 · 마이 순이고, 각 탭은 자기 화면 묶음을 갖는다.
 * 탭 아이콘은 선으로 그린 아이콘이며 선택된 탭만 색이 들어온다.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Routes from './routes';
import Icon from '../components/Icon';
import GoalsStack from './stacks/GoalsStack';
import HomeStack from './stacks/HomeStack';
import MissionsStack from './stacks/MissionsStack';
import MyStack from './stacks/MyStack';
import ReportsStack from './stacks/ReportsStack';
import { colors, typography } from '../theme';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: Routes.HOME_TAB, component: HomeStack, label: '홈', icon: 'home' },
  { name: Routes.GOALS_TAB, component: GoalsStack, label: '목표', icon: 'flag' },
  { name: Routes.MISSIONS_TAB, component: MissionsStack, label: '미션', icon: 'checklist' },
  { name: Routes.REPORTS_TAB, component: ReportsStack, label: '리포트', icon: 'chart' },
  { name: Routes.MY_TAB, component: MyStack, label: '마이', icon: 'user' },
];

export default function MainTabs() {
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
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}>
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} size={22} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
