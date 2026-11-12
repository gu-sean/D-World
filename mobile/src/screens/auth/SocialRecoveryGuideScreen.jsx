// AUTH-20 소셜 계정 안내 (비밀번호 재설정 불가)
//
// 비밀번호를 재설정하려는 번호가 소셜 계정으로 가입돼 있을 때 보인다.
// 소셜 계정에는 우리 쪽 비밀번호가 없으므로, 그 소셜로 로그인하도록 안내한다.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PROVIDER_NAMES = { google: '구글', naver: '네이버', apple: '애플' };

export default function SocialRecoveryGuideScreen({ navigation, route }) {
  const providerName = PROVIDER_NAMES[route.params?.provider] ?? '소셜';

  return (
    <Screen title="소셜 계정" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        <Icon name="user" size={48} color={colors.primary} />
        <Text style={styles.heading}>{providerName} 계정으로 가입한 번호예요</Text>
        <Text style={styles.description}>
          소셜 계정은 비밀번호가 따로 없어요. {providerName} 로그인을 눌러 들어와 주세요.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button title="로그인하러 가기" onPress={() => navigation.navigate(Routes.LOGIN)} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  footer: { paddingBottom: spacing.xl },
});
