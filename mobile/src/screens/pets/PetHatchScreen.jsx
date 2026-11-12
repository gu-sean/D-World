// PET-04 알 부화
//
// 해금된 펫 중 하나를 고르고 별명을 지어 준다. 앞 화면에서 종류를 정해 왔으면
// 그 종류가 이미 골라져 있다.
//
// 별명은 한글·영문 2~10자이고, 내 펫 안에서 겹치면 서버가 알려 준다.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useHatchPet, usePetSpecies, validators } from '../../client';
import {
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
    <Screen title="알 부화" onBack={() => navigation.goBack()} padded={false}>
      <QueryState
        query={species}
        isEmpty={choices.length === 0}
        emptyTitle="지금 부화할 수 있는 알이 없어요"
        emptyText="미션을 더 인증하면 새로운 펫이 열려요.">
        {() => (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <ErrorBanner error={hatchPet.error} />

              <View>
                <SectionTitle title="어떤 알을 고를까요?" />
                <View style={styles.grid}>
                  {choices.map((item) => {
                    const selected = item.id === speciesId;
                    return (
                      <Card
                        key={item.id}
                        onPress={() => setSpeciesId(item.id)}
                        style={[styles.choice, selected && styles.choiceSelected]}>
                        <PetAvatar
                          pet={{ imageUrl: item.stages?.[0]?.imageUrl ?? null, stageCode: 'egg' }}
                          size={64}
                        />
                        <Text style={styles.choiceName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.choiceMeta}>미션 {item.hatchMissionCount}개</Text>
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
                placeholder="꾸준냥이"
                maxLength={10}
                error={touched && !nicknameCheck.ok ? nicknameCheck.message : null}
                hint="한글·영문 2~10자"
              />
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title="부화하기"
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

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    width: 104,
    borderRadius: radius.lg,
  },
  choiceSelected: { borderColor: colors.primary, borderWidth: 2 },
  choiceName: { ...typography.caption, color: colors.text },
  choiceMeta: { ...typography.caption, color: colors.textSub },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
