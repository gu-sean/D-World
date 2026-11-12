// SITUATION-03 권한 상태 점검
//
// 추천이 왜 날씨를 못 보는지, 왜 "움직이는 중"을 못 알아보는지 사용자가 직접
// 확인할 수 있는 화면. 위치·활동·알림 세 권한의 현재 상태를 한눈에 보여 주고
// 꺼진 것만 다시 묻거나 설정으로 보낸다.
//
// 기기 설정은 앱 밖에서 바뀌므로 화면이 다시 보일 때마다 새로 확인한다.
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { permissions } from '../../client';
import { Button, Card, Icon, Screen, StatusTag } from '../../components';
import { colors, spacing, typography } from '../../theme';

const ITEMS = [
  {
    kind: 'location',
    icon: 'pin',
    title: '위치',
    description: '날씨와 기온을 보고 실내·실외 미션을 가려요',
    offText: '꺼져 있으면 시간대만 보고 추천해요.',
  },
  {
    kind: 'activity',
    icon: 'run',
    title: '활동 인식',
    description: '걷는 중인지 알아보고 가벼운 미션을 권해요',
    offText: '꺼져 있으면 움직임을 보지 않아요.',
  },
  {
    kind: 'notifications',
    icon: 'bell',
    title: '알림',
    description: '추천이 생겼을 때 알려 줘요',
    offText: '꺼져 있으면 앱을 열어야 추천이 보여요.',
  },
];

const TAG = {
  granted: { text: '허용', tone: 'success' },
  denied: { text: '꺼짐', tone: 'warning' },
  blocked: { text: '막힘', tone: 'danger' },
  unavailable: { text: '없음', tone: 'neutral' },
};

export default function LocationStatusScreen({ navigation }) {
  const [status, setStatus] = useState({});
  const [asking, setAsking] = useState(null);

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all(ITEMS.map((item) => permissions.check(item.kind))).then((results) => {
      if (!alive) return;
      const next = {};
      ITEMS.forEach((item, index) => {
        next[item.kind] = results[index];
      });
      setStatus(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(refresh);

  const ask = async (kind) => {
    setAsking(kind);
    const result = await permissions.request(kind);
    setAsking(null);
    setStatus((prev) => ({ ...prev, [kind]: result }));
  };

  return (
    <Screen title="권한 상태" onBack={() => navigation.goBack()} padded={false}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          권한을 끄고도 추천은 받을 수 있어요. 켜 두면 더 잘 맞는 미션이 나와요.
        </Text>

        {ITEMS.map((item) => {
          const value = status[item.kind];
          const tag = TAG[value];

          return (
            <Card key={item.kind} style={styles.card}>
              <View style={styles.topRow}>
                <Icon name={item.icon} size={20} color={colors.primary} />
                <Text style={styles.title}>{item.title}</Text>
                {tag ? <StatusTag text={tag.text} tone={tag.tone} /> : null}
              </View>

              <Text style={styles.description}>{item.description}</Text>

              {value && value !== 'granted' && value !== 'unavailable' && (
                <>
                  <Text style={styles.offText}>{item.offText}</Text>
                  {value === 'blocked' ? (
                    <Button
                      title="설정 열기"
                      variant="secondary"
                      size="sm"
                      onPress={() => permissions.openSettings()}
                    />
                  ) : (
                    <Button
                      title="허용하기"
                      size="sm"
                      onPress={() => ask(item.kind)}
                      loading={asking === item.kind}
                    />
                  )}
                </>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  hint: { ...typography.caption, color: colors.textSub },
  card: { gap: spacing.xs, alignItems: 'flex-start' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' },
  title: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  description: { ...typography.caption, color: colors.textSub },
  offText: { ...typography.caption, color: colors.warning },
});
