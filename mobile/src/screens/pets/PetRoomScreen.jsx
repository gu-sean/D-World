// PET-01 펫 방
//
// 대표 펫을 크게 보여 주고, 지금 시간대에 맞는 대사와 성장 정도를 알려 준다.
// 알 단계면 부화까지 남은 미션 수가, 그 뒤로는 다음 단계까지 남은 경험치가 보인다.
//
// 아래에는 함께 있는 다른 펫들이 줄지어 있고, 누르면 대표 펫을 바꾼다.
// 펫이 하나도 없으면 도감에서 알을 고르러 갈 수 있다.
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { format, labels, useMyPets, useSetRepresentativePet } from '../../client';
import {
  Button,
  Card,
  ErrorBanner,
  PetAvatar,
  ProgressBar,
  QueryState,
  Screen,
  SectionTitle,
  StatusTag,
} from '../../components';
import useReduceMotion from '../../hooks/useReduceMotion';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

export default function PetRoomScreen({ navigation }) {
  const pets = useMyPets();
  const setRepresentative = useSetRepresentativePet();

  const list = pets.data ?? [];
  const main = list.find((pet) => pet.isRepresentative) ?? list[0] ?? null;
  const others = list.filter((pet) => pet.id !== main?.id);

  return (
    <Screen
      title="펫"
      onBack={() => navigation.goBack()}
      padded={false}
      right={
        <Button
          title="도감"
          size="sm"
          variant="text"
          icon="book"
          onPress={() => navigation.navigate(Routes.PET_COLLECTION)}
        />
      }>
      <QueryState
        query={pets}
        isEmpty={list.length === 0}
        emptyTitle="아직 함께하는 펫이 없어요"
        emptyText="도감에서 마음에 드는 알을 골라 보세요."
        emptyContent={<PetEmpty onStart={() => navigation.navigate(Routes.PET_HATCH)} />}>
        {() => (
          <ScrollView contentContainerStyle={styles.body}>
            <ErrorBanner error={setRepresentative.error} />

            <Card style={styles.mainCard}>
              {main.stageCode === 'egg' ? <WobblyEgg /> : <PetAvatar pet={main} size={120} />}
              <Text style={styles.nickname}>{main.nickname}</Text>
              {/* 알일 때는 어떤 동물인지 숨긴다 — 아기로 자라는 순간 공개 */}
              <Text style={styles.species}>
                {main.stageCode === 'egg'
                  ? `${labels.petStageCode.egg} · Lv.${main.levelNo}`
                  : `${main.speciesName} · ${labels.petStageCode[main.stageCode]} · Lv.${main.levelNo}`}
              </Text>
              {main.stageCode === 'egg' && (
                <View style={styles.eggHint}>
                  <StatusTag text="어떤 동물일까요? 깨어나면 알려 드려요" tone="primary" />
                </View>
              )}

              {!!main.dialogue && (
                <View style={styles.bubble}>
                  <Text style={styles.dialogue}>{main.dialogue}</Text>
                </View>
              )}

              {main.hatchProgress ? (
                <View style={styles.progressBox}>
                  <ProgressBar
                    rate={main.hatchProgress.done / Math.max(1, main.hatchProgress.required)}
                    label={`부화까지 미션 ${main.hatchProgress.done}/${main.hatchProgress.required}`}
                  />
                </View>
              ) : (
                <View style={styles.progressBox}>
                  <ProgressBar
                    rate={main.nextStageXp ? main.totalXp / main.nextStageXp : 1}
                    label={
                      main.nextStageXp
                        ? `다음 단계까지 ${format.formatNumber(main.nextStageXp - main.totalXp)} XP`
                        : '마지막 단계예요'
                    }
                  />
                </View>
              )}

              <StatusTag
                text={`보상 보너스 +${Math.round(main.bonusRate * 100)}%`}
                tone="primary"
              />
            </Card>

            {others.length > 0 && (
              <View>
                <SectionTitle title="함께 있는 펫" />
                <View style={styles.others}>
                  {others.map((pet) => (
                    <Card
                      key={pet.id}
                      onPress={() => setRepresentative.mutate({ petId: pet.id })}
                      style={styles.otherCard}>
                      <PetAvatar pet={pet} size={56} animated={false} />
                      <Text style={styles.otherName} numberOfLines={1}>
                        {pet.nickname}
                      </Text>
                      <Text style={styles.otherStage}>{labels.petStageCode[pet.stageCode]}</Text>
                    </Card>
                  ))}
                </View>
                <Text style={styles.hint}>펫을 누르면 대표 펫이 바뀌어요.</Text>
              </View>
            )}

            {main.stageCode === 'egg' && (
              <Button
                title="미션 하러 가기"
                onPress={() => navigation.navigate(Routes.HOME_TAB)}
                full
              />
            )}

            <Button
              title="새 알 키우기"
              variant="secondary"
              onPress={() => navigation.navigate(Routes.PET_HATCH)}
              full
            />
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

/**
 * 알 그림(배경 없이)이 3초마다 좌우로 살짝 흔들린다. 알을 누르면 바로 한 번 더 흔들린다.
 * 기기의 '동작 줄이기' 설정이 켜져 있으면 움직이지 않는다.
 */
function WobblyEgg() {
  const swing = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  const wobble = useCallback(() => {
    const step = (toValue, duration) =>
      Animated.timing(swing, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
    Animated.sequence([step(1, 140), step(-1, 280), step(1, 280), step(0, 140)]).start();
  }, [swing]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const first = setTimeout(wobble, 600);
    const timer = setInterval(wobble, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [reduceMotion, wobble]);

  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] });
  const shift = swing.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });

  return (
    <Pressable
      onPress={reduceMotion ? undefined : wobble}
      accessibilityRole="image"
      accessibilityLabel="알">
      <Animated.Image
        source={require('../../assets/images/egg.png')}
        style={[wobblyStyles.egg, { transform: [{ translateX: shift }, { rotate }] }]}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const wobblyStyles = StyleSheet.create({
  egg: { width: 170, height: 170 },
});

/** 아직 펫이 없을 때: 알 그림과 부화하러 가는 버튼 */
function PetEmpty({ onStart }) {
  return (
    <View style={emptyStyles.wrap}>
      <Image
        source={require('../../assets/images/egg.png')}
        style={emptyStyles.egg}
        resizeMode="contain"
      />
      <Text style={emptyStyles.title}>아직 함께하는 펫이 없어요</Text>
      <Text style={emptyStyles.text}>알을 골라 키우면{'\n'}운동할 때마다 함께 자라요.</Text>
      <View style={emptyStyles.action}>
        <Button title="알 고르러 가기" onPress={onStart} />
      </View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  egg: { width: 180, height: 180, marginBottom: spacing.sm },
  title: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  text: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  action: { marginTop: spacing.md, minWidth: 180 },
});

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  mainCard: { alignItems: 'center', gap: spacing.sm },
  nickname: { ...typography.title, color: colors.text },
  species: { ...typography.caption, color: colors.textSub },
  eggHint: { alignSelf: 'center' },
  bubble: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dialogue: { ...typography.body, color: colors.text, textAlign: 'center' },
  progressBox: { alignSelf: 'stretch', marginTop: spacing.xs },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  otherCard: { alignItems: 'center', gap: spacing.xs, width: 100, padding: spacing.md },
  otherName: { ...typography.caption, color: colors.text },
  otherStage: { ...typography.caption, color: colors.textSub },
  hint: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm },
});
