// PET-01 펫 키우기
//
// 지금 키우는 펫(대표 펫)을 바로 보여 준다. 알이면 알이 흔들린다.
//   위: 펫 그림 (키우는 펫이 없으면 "+" 버튼 → 알 고르기)
//   가운데: 성장 단계 — 알은 "부화까지 세부 미션 n/3", 아기는 "성체까지 경험치 n/450"
//   아래: 내가 가진 펫 경험치 + "경험치 주기"(10씩, 효과와 진동)
//   맨 아래: 펫 도감 · 새 펫 키우기
//
// 펫 경험치는 세부 미션을 완료하면 하루에 한 번 30씩 쌓이고, 사용자가 직접 먹여야 펫이 자란다.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  haptics,
  labels,
  useFeedPet,
  useMyPets,
  usePetXpWallet,
  useSetRepresentativePet,
} from '../../client';
import {
  Button,
  Card,
  ErrorBanner,
  Icon,
  PetAvatar,
  ProgressBar,
  QueryState,
  Screen,
  SectionTitle,
} from '../../components';
import useReduceMotion from '../../hooks/useReduceMotion';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

const STAGE_TEXT = { 1: '알', 2: '아기', 3: '성체' };

export default function PetRoomScreen({ navigation }) {
  const pets = useMyPets();
  const wallet = usePetXpWallet();
  const feed = useFeedPet();
  const setRepresentative = useSetRepresentativePet();
  const reduceMotion = useReduceMotion();

  const list = pets.data ?? [];
  const main = list.find((pet) => pet.isRepresentative) ?? null;
  const others = list.filter((pet) => pet.id !== main?.id);
  const balance = wallet.data?.balance ?? 0;
  const feedXp = wallet.data?.feedXp ?? 10;

  // 경험치 주기 효과: "+10 XP"가 위로 떠오르며 사라지고, 펫이 통통 튄다
  const [bursts, setBursts] = useState([]);
  const bounce = useRef(new Animated.Value(1)).current;

  const playEffect = useCallback(
    (amount) => {
      haptics.light();
      const id = Date.now() + Math.random();
      setBursts((prev) => [...prev, { id, amount }]);
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1.12, duration: 120, useNativeDriver: true }),
          Animated.spring(bounce, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
        ]).start();
      }
    },
    [bounce, reduceMotion],
  );

  const giveXp = () => {
    if (!main) return;
    feed.mutate(
      { petId: main.id },
      {
        onSuccess: (result) => {
          playEffect(result.fedXp);
          if (result.evolved) {
            haptics.medium();
            navigation.navigate(Routes.PET_EVOLUTION_MODAL, { petId: main.id });
          }
        },
      },
    );
  };

  const growth = main?.growth;
  const stageNo = main?.stageNo ?? 1;
  let feedHint = null;
  if (main && stageNo === 1) feedHint = `알은 아직 먹을 수 없어요. 세부 미션 ${growth?.hatchRequired ?? 3}개를 완료하면 부화해요.`;
  else if (main && stageNo === 3) feedHint = '다 자랐어요! 새 펫을 키워 볼까요?';
  else if (main && balance < feedXp) feedHint = '경험치가 부족해요. 세부 미션을 완료하면 하루 한 번 30 XP를 받아요.';

  return (
    <Screen title="펫 키우기" onBack={() => navigation.goBack()} padded={false}>
      {/* 펫이 없어도 빈 화면 대신 "+" 버튼을 보여 주므로 비어 있음 처리를 끈다 */}
      <QueryState query={pets} isEmpty={false}>
        {() => (
          <ScrollView contentContainerStyle={styles.body}>
            <ErrorBanner error={feed.error ?? setRepresentative.error} />

            {/* 위: 펫 (없으면 +) */}
            <Card style={styles.stage}>
              {main ? (
                <>
                  <View style={styles.petArea}>
                    <Animated.View style={{ transform: [{ scale: bounce }] }}>
                      {stageNo === 1 ? <WobblyEgg /> : <PetAvatar pet={main} size={150} />}
                    </Animated.View>
                    {bursts.map((b) => (
                      <XpBurst
                        key={b.id}
                        amount={b.amount}
                        onDone={() => setBursts((prev) => prev.filter((x) => x.id !== b.id))}
                      />
                    ))}
                  </View>
                  <Text style={styles.nickname}>{main.nickname}</Text>
                  <Text style={styles.species}>
                    {stageNo === 1 ? '어떤 동물일까요? 깨어나면 알려 드려요' : `${main.speciesName} · ${STAGE_TEXT[stageNo]}`}
                  </Text>
                  {!!main.dialogue && stageNo !== 1 && (
                    <View style={styles.bubble}>
                      <Text style={styles.dialogue}>{main.dialogue}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Pressable
                  onPress={() => navigation.navigate(Routes.PET_HATCH)}
                  accessibilityRole="button"
                  accessibilityLabel="새 펫 고르기"
                  style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}>
                  <Icon name="plus" size={56} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.addText}>펫을 골라 주세요</Text>
                </Pressable>
              )}
            </Card>

            {/* 성장 창: 단계와 경험치 */}
            {main && (
              <Card style={styles.growth}>
                <View style={styles.growthHead}>
                  <Text style={styles.growthTitle}>성장</Text>
                  <Text style={styles.growthStage}>
                    {[1, 2, 3].map((n) => STAGE_TEXT[n]).join(' → ')}
                  </Text>
                </View>
                {stageNo === 1 && (
                  <ProgressBar
                    rate={(growth?.hatchDone ?? 0) / Math.max(1, growth?.hatchRequired ?? 3)}
                    label={`부화까지 세부 미션 ${growth?.hatchDone ?? 0}/${growth?.hatchRequired ?? 3}`}
                  />
                )}
                {stageNo === 2 && (
                  <ProgressBar
                    rate={(growth?.xp ?? 0) / Math.max(1, growth?.adultXp ?? 450)}
                    label={`성체까지 경험치 ${format.formatNumber(growth?.xp ?? 0)}/${format.formatNumber(growth?.adultXp ?? 450)}`}
                  />
                )}
                {stageNo === 3 && <ProgressBar rate={1} label="다 자랐어요" />}

                <View style={styles.walletRow}>
                  <Icon name="paw" size={18} color={colors.primary} />
                  <Text style={styles.walletText}>
                    내 펫 경험치 <Text style={styles.walletValue}>{format.formatNumber(balance)} XP</Text>
                  </Text>
                </View>
                <Text style={styles.walletHint}>
                  {wallet.data?.earnedToday
                    ? '오늘의 미션 경험치(30)를 이미 받았어요.'
                    : '오늘 세부 미션을 완료하면 30 XP를 받아요.'}
                </Text>
              </Card>
            )}

            {/* 경험치 주기 */}
            {main && (
              <View style={styles.feedBox}>
                <Button
                  title={`경험치 주기 (+${feedXp} XP)`}
                  icon="paw"
                  onPress={giveXp}
                  loading={feed.isPending}
                  disabled={stageNo !== 2 || balance < feedXp}
                  full
                />
                {!!feedHint && <Text style={styles.feedHint}>{feedHint}</Text>}
              </View>
            )}

            {/* 펫 도감 · 새 펫 키우기 */}
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button
                  title="펫 도감"
                  variant="secondary"
                  icon="book"
                  onPress={() => navigation.navigate(Routes.PET_COLLECTION)}
                  full
                />
              </View>
              <View style={styles.action}>
                <Button
                  title="새 펫 키우기"
                  variant="secondary"
                  icon="plus"
                  onPress={() => navigation.navigate(Routes.PET_HATCH)}
                  full
                />
              </View>
            </View>

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
                      <Text style={styles.otherStage}>{labels.petStageCode[pet.stageCode] ?? STAGE_TEXT[pet.stageNo]}</Text>
                    </Card>
                  ))}
                </View>
                <Text style={styles.hint}>누르면 그 펫을 키워요.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  );
}

/** "+10 XP"가 펫 위로 떠오르며 사라진다 */
function XpBurst({ amount, onDone }) {
  const progress = useRef(new Animated.Value(0)).current;
  // 부모가 다시 그려져도 애니메이션이 처음부터 다시 시작하지 않게 마지막 onDone만 기억
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => doneRef.current?.());
  }, [progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -90] });
  const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.burst, { opacity, transform: [{ translateY }, { scale }] }]}>
      <Text style={styles.burstText}>+{amount} XP</Text>
    </Animated.View>
  );
}

/**
 * 알 그림이 3초마다 좌우로 살짝 흔들린다. 누르면 한 번 더 흔들린다.
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
    <Pressable onPress={reduceMotion ? undefined : wobble} accessibilityRole="image" accessibilityLabel="알">
      <Animated.Image
        source={require('../../assets/images/egg.png')}
        style={[styles.egg, { transform: [{ translateX: shift }, { rotate }] }]}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  stage: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  petArea: { alignItems: 'center', justifyContent: 'center', minHeight: 180 },
  egg: { width: 170, height: 170 },
  nickname: { ...typography.title, color: colors.text },
  species: { ...typography.caption, color: colors.textSub },
  bubble: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dialogue: { ...typography.body, color: colors.text, textAlign: 'center' },
  addButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addPressed: { opacity: 0.7 },
  addText: { ...typography.caption, color: colors.primary },
  growth: { gap: spacing.sm },
  growthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  growthTitle: { ...typography.bodyStrong, color: colors.text },
  growthStage: { ...typography.caption, color: colors.textSub },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  walletText: { ...typography.body, color: colors.text },
  walletValue: { ...typography.bodyStrong, color: colors.primary },
  walletHint: { ...typography.caption, color: colors.textSub },
  feedBox: { gap: spacing.xs },
  feedHint: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  otherCard: { alignItems: 'center', gap: spacing.xs, width: 100, padding: spacing.md },
  otherName: { ...typography.caption, color: colors.text },
  otherStage: { ...typography.caption, color: colors.textSub },
  hint: { ...typography.caption, color: colors.textSub, marginTop: spacing.sm },
  burst: {
    position: 'absolute',
    top: 10,
    // 안드로이드에서 그림자(elevation)가 있는 펫 그림보다 위에 그려지게
    zIndex: 10,
    elevation: 10,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  burstText: { ...typography.bodyStrong, color: colors.onPrimary },
});
