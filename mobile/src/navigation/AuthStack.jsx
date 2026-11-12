/**
 * 로그인하지 않았을 때 보이는 화면들.
 *
 * 로그인에서 시작해서 가입(휴대폰·소셜)과 비밀번호 재설정으로 갈라진다.
 * 머리글은 각 화면이 `Screen` 컴포넌트로 직접 그리므로 여기서는 끈다.
 *
 * 가입 완료 화면은 여기에 없다. 가입에 성공하는 순간 세션이 열려 이 묶음 전체가
 * 사라지기 때문에, 로그인한 뒤의 묶음(`RootNavigator`)에 들어 있다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Routes from './routes';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupMethodScreen from '../screens/auth/SignupMethodScreen';
import SocialSignupConfirmScreen from '../screens/auth/SocialSignupConfirmScreen';
import TermsAgreementScreen from '../screens/auth/TermsAgreementScreen';
import PhoneNumberScreen from '../screens/auth/PhoneNumberScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';
import PasswordSetupScreen from '../screens/auth/PasswordSetupScreen';
import NicknameSetupScreen from '../screens/auth/NicknameSetupScreen';
import ExistingAccountScreen from '../screens/auth/ExistingAccountScreen';
import SocialAuthErrorScreen from '../screens/auth/SocialAuthErrorScreen';
import PasswordChangedScreen from '../screens/auth/PasswordChangedScreen';
import SocialRecoveryGuideScreen from '../screens/auth/SocialRecoveryGuideScreen';
import ResetAccountNotFoundScreen from '../screens/auth/ResetAccountNotFoundScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.LOGIN} component={LoginScreen} />
      <Stack.Screen name={Routes.SIGNUP_METHOD} component={SignupMethodScreen} />
      <Stack.Screen name={Routes.SOCIAL_SIGNUP_CONFIRM} component={SocialSignupConfirmScreen} />
      <Stack.Screen name={Routes.TERMS_AGREEMENT} component={TermsAgreementScreen} />
      <Stack.Screen name={Routes.PHONE_NUMBER} component={PhoneNumberScreen} />
      <Stack.Screen name={Routes.OTP_VERIFY} component={OtpVerifyScreen} />
      <Stack.Screen name={Routes.PASSWORD_SETUP} component={PasswordSetupScreen} />
      <Stack.Screen name={Routes.NICKNAME_SETUP} component={NicknameSetupScreen} />
      <Stack.Screen name={Routes.EXISTING_ACCOUNT} component={ExistingAccountScreen} />
      <Stack.Screen name={Routes.SOCIAL_AUTH_ERROR} component={SocialAuthErrorScreen} />
      <Stack.Screen name={Routes.PASSWORD_CHANGED} component={PasswordChangedScreen} />
      <Stack.Screen name={Routes.SOCIAL_RECOVERY_GUIDE} component={SocialRecoveryGuideScreen} />
      <Stack.Screen name={Routes.RESET_ACCOUNT_NOT_FOUND} component={ResetAccountNotFoundScreen} />
    </Stack.Navigator>
  );
}
