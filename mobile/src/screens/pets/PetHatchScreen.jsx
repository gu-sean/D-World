// PET-04 알 부화
//
// 해금된 펫 중 하나를 고르고 별명을 지어 준다. 앞 화면에서 종류를 정해 왔으면
// 그 종류가 이미 골라져 있다.
//
// 별명은 한글·영문 2~10자이고, 내 펫 안에서 겹치면 서버가 알려 준다.
import React, { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useHatchPet, usePetSpecies, validators } from '../../client';
import {
  FormScrollView,
  Button,
  Card,
  ErrorBanner,
  PetAvatar,
  QueryState,
  Screen,
  SectionTitle,
  TextField,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';

export default function PetHatchScreen({ navigation, route }) {
  const [speciesId, setSpeciesId] = useState(route.params?.speciesId ?? null);
  const [nickname, setNickname] = useState('');
  const [touched, setTouched] = useState(false);
  // 3열: 화면 너비에서 좌우 여백·칸 사이 간격을 뺀 만큼을 3등분해 가운데에 맞춘다
  const { width } = useWindowDimensions();
  const choiceWidth = Math.floor((width - spacing.lg * 2 - GRID_GAP * 2) / 3);

  const species = usePetSpecies();
  const hatchPet = useHatchPet();

  const choices = (species.data ?? []).filter((item) => item.isUnlocked && !item.isOwned);
  const nicknameCheck = validators.validatePetNickname(nickname);
  const ready = !!speciesId && nicknameCheck.ok;

  const hatch = () =>
    hatchPet.mutate(
      { speciesId, nickname: nickname.trim() },
      { onSuccess: () => navigation.replace(Routes.PET_ROOM) },
    );

  return (
    <Screen title="새 펫 키우기" onBack={() => navigation.goBack()} padded={false}>
      <QueryState
        query={species}
        isEmpty={choices.length === 0}
        emptyTitle="지금 고를 수 있는 알이 없어요"
        emptyText="미션을 더 인증하면 새로운 펫이 열려요.">
        {() => (
          <>
            <FormScrollView contentContainerStyle={styles.body}>
              <ErrorBanner error={hatchPet.error} />

              <View>
                <SectionTitle title="어떤 알을 고를까요?" />
                <Text style={styles.guide}>
                  세부 미션 3개를 완료하면 부화하고, 경험치 450을 먹이면 다 자라요. 어떤 펫인지는 깨어나야 알 수 있어요.
                </Text>
                <View style={styles.grid}>
                  {choices.map((item, index) => {
                    const selected = item.id === speciesId;
                    return (
                      <Card
                        key={item.id}
                        onPress={() => setSpeciesId(item.id)}
                        accessibilityLabel={`알 ${index + 1}`}
                        style={[
                          styles.choice,
                          { width: choiceWidth },
                          selected && styles.choiceSelected,
                        ]}>
                        <PetAvatar
                          pet={{ imageUrl: item.stages?.[0]?.imageUrl ?? null, stageCode: 'egg' }}
                          size={64}
                        />
                        <Text style={styles.choiceMeta}>알 {index + 1}</Text>
                      </Card>
                    );
                  })}
                </View>
              </View>

              <TextField
                label="별명"
                value={nickname}
                onChangeText={(text) => {
                  setNickname(text);
                  setTouched(true);
                }}
                maxLength={10}
                error={touched && !nicknameCheck.ok ? nicknameCheck.message : null}
                hint="한글·영문 2~10자"
              />
            </FormScrollView>

            <View style={styles.footer}>
              <Button
                title="이 알 키우기"
                onPress={hatch}
                loading={hatchPet.isPending}
                disabled={!ready}
                full
              />
            </View>
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const GRID_GAP = spacing.sm;

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, justifyContent: 'center' },
  choice: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  choiceSelected: { borderColor: colors.primary, borderWidth: 2 },
  choiceMeta: { ...typography.caption, color: colors.textSub },
  guide: { ...typography.caption, color: colors.textSub, marginBottom: spacing.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
