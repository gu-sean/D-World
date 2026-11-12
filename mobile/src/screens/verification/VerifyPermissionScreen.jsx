// VERIFY-02 권한 안내 · 요청
//
// 촬영이나 러닝을 시작하기 직전에만 보인다. 왜 이 권한이 필요한지 먼저 설명하고
// 사용자가 누를 때 기기 팝업을 띄운다 — 가입할 때 한꺼번에 묻지 않는다.
//
// "다시 묻지 않음"으로 막혀 있으면 팝업이 뜨지 않으므로 설정 화면으로 보낸다.
// 허용되면 앞 화면으로 돌아가 하던 일을 이어 간다.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { permissions } from '../../client';
import { Button, Card, Icon, Screen } from '../../components';
import { colors, spacing, typography } from '../../theme';

const GUIDES = {
  camera: {
    icon: 'camera',
    title: '카메라 권한이 필요해요',
    description: '운동 영상이나 사진을 찍어 미션을 인증해요.',
    points: [
      '찍은 파일은 판정이 끝나면 기기에서 지워져요.',
      '사진·영상은 인증 목적으로만 쓰여요.',
    ],
    kinds: ['camera'],
  },
  location: {
    icon: 'pin',
    title: '위치와 활동 권한이 필요해요',
    description: '달린 거리와 걸음 수를 재서 러닝 미션을 인증해요.',
    points: [
      '위치는 러닝 기록 파일에만 담기고 따로 저장하지 않아요.',
      '걸음 센서가 없어도 러닝은 할 수 있어요.',
    ],
    kinds: ['location', 'activity'],
  },
};

export default function VerifyPermissionScreen({ navigation, route }) {
  const { kind = 'camera' } = route.params ?? {};
  const guide = GUIDES[kind] ?? GUIDES.camera;

  const [status, setStatus] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    permissions.check(guide.kinds[0]).then(setStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const ask = async () => {
    setAsking(true);
    let last = null;
    for (const name of guide.kinds) {
      last = await permissions.request(name);
    }
    setAsking(false);
    setStatus(last);
    if (last === 'granted') navigation.goBack();
  };

  const blocked = status === 'blocked';

  return (
    <Screen title="권한 안내" onBack={() => navigation.goBack()}>
      <View style={styles.wrap}>
        <Icon name={guide.icon} size={48} color={colors.primary} />
        <Text style={styles.heading}>{guide.title}</Text>
        <Text style={styles.description}>{guide.description}</Text>

        <Card style={styles.card}>
          {guide.points.map((point) => (
            <View key={point} style={styles.pointRow}>
              <Icon name="check" size={14} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.point}>{point}</Text>
            </View>
          ))}
        </Card>

        {blocked && (
          <Text style={styles.blocked}>
            권한이 막혀 있어요. 설정에서 직접 켜 주셔야 해요.
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        {blocked ? (
          <Button title="설정 열기" onPress={() => permissions.openSettings()} full />
        ) : (
          <Button title="권한 허용하기" onPress={ask} loading={asking} full />
        )}
        <Button title="나중에" variant="text" onPress={() => navigation.goBack()} full />
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
