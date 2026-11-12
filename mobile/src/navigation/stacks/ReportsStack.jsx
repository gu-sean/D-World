/**
 * 리포트 탭의 화면 묶음.
 *
 * 기간 요약에서 시작해 월별 달력과 AI 리포트 상세로 간다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import ReportScreen from '../../screens/reports/ReportScreen';
import MonthlyCalendarScreen from '../../screens/reports/MonthlyCalendarScreen';
import AiReportDetailScreen from '../../screens/reports/AiReportDetailScreen';

const Stack = createNativeStackNavigator();

export default function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.REPORT} component={ReportScreen} />
      <Stack.Screen name={Routes.MONTHLY_CALENDAR} component={MonthlyCalendarScreen} />
      <Stack.Screen name={Routes.AI_REPORT_DETAIL} component={AiReportDetailScreen} />
    </Stack.Navigator>
  );
}
