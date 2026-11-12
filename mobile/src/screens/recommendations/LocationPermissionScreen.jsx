// SITUATION-02 위치 권한 요청
//
// 상황 추천을 받기 직전에만 위치 권한을 묻는다. 허용하면 바로 추천 화면으로,
// 거절하더라도 추천은 받을 수 있으므로 "위치 없이 받기" 길을 함께 둔다.
//
// "다시 묻지 않음"으로 막힌 경우에는 팝업이 뜨지 않으므로 설정으로 보낸다.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { permissions } from '../../client';
import { Button, Card, Icon, Screen } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const POINTS = [
  '지금 있는 곳의 날씨와 기온만 확인해요.',
  '좌표는 추천 요청 한 번에만 쓰고 저장하지 않아요.',
  '허용하지 않아도 시간대에 맞는 추천은 받을 수 있어요.',
];

export default function LocationPermissionScreen({ navigation, route }) {
  const { next = 'weather' } = route.params ?? {};

  const [status, setStatus] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    permissions.check('location').then(setStatus);
  }, []);

  const goRecommend = (useLocation) =>
    navigation.replace(Routes.SITUATION_RECOMMEND, { kind: next, useLocation });

  const ask = async () => {
    setAsking(true);
    const result = await permissions.request('location');
    setAsking(false);
    setStatus(result);
    if (result === 'granted') goRecommend(true);
  };

  const blocked = status === 'blocked';

  return (
    <Screen title="위치 권한" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        <Icon name="pin" size={48} color={colors.primary} />
        <Text style={styles.heading}>날씨를 보려면 위치가 필요해요</Text>
        <Text style={styles.description}>
          비 오는 날엔 실내 미션, 선선한 날엔 러닝처럼{'\n'}날씨에 맞는 미션을 골라 줘요.
        </Text>

        <Card style={styles.card}>
          {POINTS.map((point) => (
            <View key={point} style={styles.pointRow}>
              <Icon name="check" size={14} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.point}>{point}</Text>
            </View>
          ))}
        </Card>

        {blocked && (
          <Text style={styles.blocked}>위치 권한이 막혀 있어요. 설정에서 켜 주세요.</Text>
        )}
      </View>

      <View style={styles.footer}>
        {blocked ? (
          <Button title="설정 열기" onPress={() => permissions.openSettings()} full />
        ) : (
          <Button title="위치 허용하기" onPress={ask} loading={asking} full />
        )}
        <Button title="위치 없이 추천받기" variant="text" onPress={() => goRecommend(false)} full />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.title, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  card: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  point: { ...typography.caption, color: colors.textSub, flex: 1 },
  blocked: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  footer: { gap: spacing.sm, paddingBottom: spacing.xl },
});
