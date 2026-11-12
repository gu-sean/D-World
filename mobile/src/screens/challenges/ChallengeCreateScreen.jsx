// CHALLENGE-06 챌린지 만들기
//
// 사용자가 직접 챌린지를 만든다. 난이도·완주 조건·보상·정원은 서버가 정하므로
// 여기서는 제목·설명·분야·운동·하루 목표·기간·시작일만 받는다.
//
// 시작일은 오늘로부터 이틀 뒤부터 고를 수 있다 — 그 사이에 사람을 모으기 위해서다.
// 보내기 전에 길이와 목표 범위를 미리 검사해 되돌아오는 일을 줄인다.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useCreateChallenge,
  useExerciseTypes,
  useGoalCategories,
  validators,
} from '../../client';
import {
  Button,
  Card,
  DateField,
  ErrorBanner,
  Icon,
  OptionRow,
  Screen,
  TextField,
} from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const PERIODS = [
  { value: '7', label: '7일' },
  { value: '14', label: '14일' },
  { value: '30', label: '30일' },
];

/** 시작일로 고를 수 있는 가장 이른 날 — 오늘+2일 (07 §14). */
function earliestStart() {
  const today = new Date(`${format.todayKst()}T00:00:00+09:00`);
  today.setDate(today.getDate() + 2);
  return today.toISOString().slice(0, 10);
}

export default function ChallengeCreateScreen({ navigation }) {
  const categories = useGoalCategories();
  const exercises = useExerciseTypes();
  const createChallenge = useCreateChallenge();

  const minStart = useMemo(earliestStart, []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryCode: null,
    exerciseCode: null,
    targetValue: '',
    periodDays: '7',
    startDate: minStart,
  });
  const [touched, setTouched] = useState(false);

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  };

  const isExercise = form.categoryCode === 'exercise';
  const exercise = (exercises.data ?? []).find((e) => e.code === form.exerciseCode) ?? null;
  const targetUnit = exercise?.targetUnit ?? 'times';

  const titleCheck = validators.validateLength(form.title, 'challengeTitle');
  const descriptionCheck = validators.validateLength(form.description, 'challengeDescription');
  const targetCheck = validators.validateTarget(form.targetValue, {
    exerciseCode: form.exerciseCode,
    targetUnit,
  });
  const startCheck =
    form.startDate >= minStart
      ? { ok: true }
      : { ok: false, message: `${format.formatDate(minStart)} 이후로 정해 주세요.` };

  const ready =
    titleCheck.ok &&
    descriptionCheck.ok &&
    targetCheck.ok &&
    startCheck.ok &&
    !!form.categoryCode &&
    (!isExercise || !!form.exerciseCode);

  const periodDays = Number(form.periodDays);
  const requiredDays = Math.ceil(periodDays * 0.8);
  const rewardPoints = periodDays * 50;

  const submit = () =>
    createChallenge.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryCode: form.categoryCode,
        exerciseCode: isExercise ? form.exerciseCode : null,
        targetValue: Number(form.targetValue),
        targetUnit,
        periodDays,
        startDate: form.startDate,
      },
      {
        onSuccess: (challenge) => {
          if (challenge?.id) {
            navigation.replace(Routes.CHALLENGE_DETAIL, { challengeId: challenge.id });
          } else {
            navigation.goBack();
          }
        },
      },
    );

  return (
    <Screen title="챌린지 만들기" onBack={() => navigation.goBack()} padded={false}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={createChallenge.error} />

        <TextField
          label="챌린지 이름"
          value={form.title}
          onChangeText={set('title')}
          placeholder="예) 2주 스쿼트 챌린지"
          maxLength={30}
          error={touched && !titleCheck.ok ? titleCheck.message : null}
        />

        <TextField
          label="설명"
          value={form.description}
          onChangeText={set('description')}
          placeholder="어떤 챌린지인지, 누구에게 맞는지 적어 주세요."
          multiline
          maxLength={500}
          hint="이름·연락처 같은 개인정보는 적지 마세요."
          error={touched && !descriptionCheck.ok ? descriptionCheck.message : null}
        />

        <OptionRow
          label="분야"
          options={(categories.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
          value={form.categoryCode}
          onChange={(value) => {
            set('categoryCode')(value);
            if (value !== 'exercise') set('exerciseCode')(null);
          }}
        />

        {isExercise && (
          <OptionRow
            label="운동 종류"
            options={(exercises.data ?? []).map((e) => ({ value: e.code, label: e.name }))}
            value={form.exerciseCode}
            onChange={set('exerciseCode')}
          />
        )}

        <TextField
          label={`하루 목표 (${labels.targetUnit[targetUnit] ?? targetUnit})`}
          value={form.targetValue}
          onChangeText={(text) => set('targetValue')(text.replace(/\D/g, '').slice(0, 6))}
          placeholder="20"
          keyboardType="number-pad"
          hint={exercise ? `${exercise.minTarget}~${exercise.maxTarget} 사이로 정해 주세요` : null}
          error={touched && !targetCheck.ok ? targetCheck.message : null}
        />

        <OptionRow
          label="기간"
          options={PERIODS}
          value={form.periodDays}
          onChange={set('periodDays')}
        />

        <DateField
          label="시작일"
          value={form.startDate}
          onChange={set('startDate')}
          min={minStart}
          error={touched && !startCheck.ok ? startCheck.message : null}
        />
        <Text style={styles.startHint}>
          사람을 모을 시간이 필요해서 {format.formatDate(minStart)}부터 시작할 수 있어요.
        </Text>

        <Card style={styles.preview}>
          <Text style={styles.previewLabel}>서버가 정하는 값</Text>
          <View style={styles.previewRow}>
            <Icon name="check" size={16} color={colors.success} />
            <Text style={styles.previewText}>
              {periodDays}일 중 {requiredDays}일 성공하면 완주
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Icon name="coin" size={16} color={colors.primary} />
            <Text style={styles.previewText}>
              완주 보상 약 {format.formatPoints(rewardPoints)}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Icon name="user" size={16} color={colors.textSub} />
            <Text style={styles.previewText}>난이도 보통 · 정원 없음</Text>
          </View>
          <Text style={styles.previewNote}>
            최종 값은 서버가 정하고, 만든 챌린지는 검수를 거쳐 공개돼요.
          </Text>
        </Card>

        <Button
          title="챌린지 만들기"
          onPress={submit}
          loading={createChallenge.isPending}
          disabled={!ready}
          full
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  startHint: { ...typography.caption, color: colors.textSub, marginTop: -spacing.md },
  preview: { gap: spacing.xs },
  previewLabel: { ...typography.caption, color: colors.textSub },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewText: { ...typography.body, color: colors.text, flex: 1 },
  previewNote: { ...typography.caption, color: colors.textSub, marginTop: spacing.xs },
});
