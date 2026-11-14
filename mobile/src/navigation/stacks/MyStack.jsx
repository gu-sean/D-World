/**
 * 마이 탭의 화면 묶음.
 *
 * 메뉴 화면에서 프로필·펫·보상·챌린지·알림·공지·문의·설정으로 갈라진다.
 * 챌린지 상세·순위·결과는 홈 배너에서도 열리므로 루트 스택에 있다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from '../routes';
import MyScreen from '../../screens/my/MyScreen';
import ProfileEditScreen from '../../screens/my/ProfileEditScreen';
import ReconsentScreen from '../../screens/my/ReconsentScreen';
import NotificationInboxScreen from '../../screens/my/NotificationInboxScreen';
import NoticeListScreen from '../../screens/my/NoticeListScreen';
import NoticeDetailScreen from '../../screens/my/NoticeDetailScreen';
import SupportTicketListScreen from '../../screens/my/SupportTicketListScreen';
import SupportTicketFormScreen from '../../screens/my/SupportTicketFormScreen';
import SupportTicketDetailScreen from '../../screens/my/SupportTicketDetailScreen';
import SettingsScreen from '../../screens/my/SettingsScreen';
import WithdrawalScreen from '../../screens/my/WithdrawalScreen';
import SubscriptionScreen from '../../screens/my/SubscriptionScreen';
import PetRoomScreen from '../../screens/pets/PetRoomScreen';
import PetCollectionScreen from '../../screens/pets/PetCollectionScreen';
import PetDetailScreen from '../../screens/pets/PetDetailScreen';
import PetHatchScreen from '../../screens/pets/PetHatchScreen';
import StreakScreen from '../../screens/rewards/StreakScreen';
import AchievementListScreen from '../../screens/rewards/AchievementListScreen';
import PointHistoryScreen from '../../screens/rewards/PointHistoryScreen';
import ShopScreen from '../../screens/rewards/ShopScreen';

const Stack = createNativeStackNavigator();

export default function MyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.MY} component={MyScreen} />
      <Stack.Screen name={Routes.PROFILE_EDIT} component={ProfileEditScreen} />
      <Stack.Screen name={Routes.RECONSENT} component={ReconsentScreen} />

      <Stack.Screen name={Routes.PET_ROOM} component={PetRoomScreen} />
      <Stack.Screen name={Routes.PET_COLLECTION} component={PetCollectionScreen} />
      <Stack.Screen name={Routes.PET_DETAIL} component={PetDetailScreen} />
      <Stack.Screen name={Routes.PET_HATCH} component={PetHatchScreen} />

      <Stack.Screen name={Routes.STREAK} component={StreakScreen} />
      <Stack.Screen name={Routes.ACHIEVEMENT_LIST} component={AchievementListScreen} />
      <Stack.Screen name={Routes.POINT_HISTORY} component={PointHistoryScreen} />
      <Stack.Screen name={Routes.SHOP} component={ShopScreen} />


      <Stack.Screen name={Routes.NOTIFICATION_INBOX} component={NotificationInboxScreen} />
      <Stack.Screen name={Routes.NOTICE_LIST} component={NoticeListScreen} />
      <Stack.Screen name={Routes.NOTICE_DETAIL} component={NoticeDetailScreen} />

      <Stack.Screen name={Routes.SUPPORT_TICKET_LIST} component={SupportTicketListScreen} />
      <Stack.Screen name={Routes.SUPPORT_TICKET_FORM} component={SupportTicketFormScreen} />
      <Stack.Screen name={Routes.SUPPORT_TICKET_DETAIL} component={SupportTicketDetailScreen} />

      <Stack.Screen name={Routes.SETTINGS} component={SettingsScreen} />
      <Stack.Screen name={Routes.WITHDRAWAL} component={WithdrawalScreen} />
      <Stack.Screen name={Routes.SUBSCRIPTION} component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}
