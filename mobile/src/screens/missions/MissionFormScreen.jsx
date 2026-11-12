// MISSION-10·11 미션 직접 만들기·수정
//
// `missionId`가 있으면 수정, 없으면 새로 만들기다.
// 수정일 때 분야·난이도·운동 종류는 보여 주기만 하고 바꿀 수 없다 — 보상 기준이
// 그 조합에 묶여 있어서, 바꾸려면 미션을 취소하고 새로 만들어야 한다.
//
// 운동을 고르면 목표 단위와 허용 범위가 그 운동의 것으로 바뀌고,
// 범위를 벗어난 값은 보내기 전에 걸러 낸다.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useCreateMission,
  useDifficultyLevels,
  useExerciseTypes,
  useGoalCategories,
  useMission,
  useUpdateMission,
  validators,
} from '../../client';
import {
  Button,
  DateField,
  ErrorBanner,
  OptionRow,
  Screen,
  TextField,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function MissionFormScreen({ navigation, route }) {
  const { missionId, goalId, date } = route.params ?? {};
  const editing = Boolean(missionId);

  const categories = useGoalCategories();
  const difficulties = useDifficultyLevels();
  const exercises = useExerciseTypes();
  const existing = useMission(missionId);
  const createMission = useCreateMission();
  const updateMission = useUpdateMission();

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryCode: null,
    difficultyCode: null,
    exerciseCode: null,
    targetValue: '',
    estimatedDurationSeconds: '',
    scheduledDate: date ?? format.todayKst(),
    memo: '',
  });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!editing || !existing.data) return;
    const m = existing.data;
    setForm({
      title: m.title ?? '',
      description: m.description ?? '',
      categoryCode: m.categoryCode,
      difficultyCode: m.difficultyCode,
      exerciseCode: m.exerciseCode,
      targetValue: m.targetValue != null ? String(m.targetValue) : '',
      estimatedDurationSeconds: m.estimatedDurationSeconds
        ? String(m.estimatedDurationSeconds)
        : '',
      scheduledDate: m.scheduledDate,
      memo: m.memo ?? '',
    });
  }, [editing, existing.data]);

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  };

  const exercise = useMemo(
    () => (exercises.data ?? []).find((e) => e.code === form.exerciseCode) ?? null,
    [exercises.data, form.exerciseCode],
  );
  const targetUnit = exercise?.targetUnit ?? 'times';

  const titleCheck = validators.validateLength(form.title, 'missionTitle');
  const memoCheck = validators.validateLength(form.memo, 'missionNote');
  const targetCheck = validators.validateTarget(form.targetValue, {
    exerciseCode: form.exerciseCode,
    targetUnit,
  });
  const ready =
    titleCheck.ok && memoCheck.ok && targetCheck.ok && !!form.categoryCode && !!form.difficultyCode;

  const isExercise = form.categoryCode === 'exercise';

  const submit = () => {
    if (editing) {
      updateMission.mutate(
        {
          missionId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          targetValue: Number(form.targetValue),
          estimatedDurationSeconds: form.estimatedDurationSeconds
            ? Number(form.estimatedDurationSeconds)
            : null,
          scheduledDate: form.scheduledDate,
          memo: form.memo.trim() || null,
        },
        { onSuccess: () => navigation.goBack() },
      );
      return;
    }

    createMission.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || null,
        categoryCode: form.categoryCode,
        difficultyCode: form.difficultyCode,
        exerciseCode: isExercise ? form.exerciseCode : null,
        targetValue: Number(form.targetValue),
        targetUnit,
        estimatedDurationSeconds: form.estimatedDurationSeconds
          ? Number(form.estimatedDurationSeconds)
          : null,
        scheduledDate: form.scheduledDate,
        goalId,
        memo: form.memo.trim() || null,
      },
      { onSuccess: () => navigation.goBack() },
    );
  };

  const mutation = editing ? updateMission : createMission;
  const lockedLabel = (text) => `${text}${editing ? ' (수정할 수 없어요)' : ''}`;

  return (
    <Screen
      title={editing ? '미션 수정' : '미션 만들기'}
      onBack={() => navigation.goBack()}
      padded={false}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={mutation.error} />

        <TextField
          label="미션"
          value={form.title}
          onChangeText={set('title')}
          placeholder="예) 스쿼트 20개"
          maxLength={200}
          error={touched && !titleCheck.ok ? titleCheck.message : null}
        />

        <TextField
          label="설명 (선택)"
          value={form.description}
          onChangeText={set('description')}
          multiline
          maxLength={1000}
          hint="이름·연락처 같은 개인정보는 적지 마세요."
        />

        <OptionRow
          label={lockedLabel('분야')}
          options={(categories.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
          value={form.categoryCode}
          onChange={(value) => {
            set('categoryCode')(value);
            if (value !== 'exercise') set('exerciseCode')(null);
          }}
          disabled={editing}
        />

        <OptionRow
          label={lockedLabel('난이도')}
          options={(difficulties.data ?? []).map((d) => ({ value: d.code, label: d.name }))}
          value={form.difficultyCode}
          onChange={set('difficultyCode')}
          disabled={editing}
        />

        {isExercise && (
          <OptionRow
            label={lockedLabel('운동 종류')}
            options={(exercises.data ?? []).map((e) => ({ value: e.code, label: e.name }))}
            value={form.exerciseCode}
            onChange={set('exerciseCode')}
            disabled={editing}
          />
        )}

        <TextField
          label={`목표 (${labels.targetUnit[targetUnit] ?? targetUnit})`}
          value={form.targetValue}
          onChangeText={(text) => set('targetValue')(text.replace(/\D/g, '').slice(0, 6))}
          placeholder="20"
          keyboardType="number-pad"
          error={touched && !targetCheck.ok ? targetCheck.message : null}
          hint={
            exercise ? `${exercise.minTarget}~${exercise.maxTarget} 사이로 정해 주세요` : null
          }
        />

        <TextField
          label="예상 소요 시간 (선택, 분)"
          value={form.estimatedDurationSeconds ? String(Number(form.estimatedDurationSeconds) / 60) : ''}
          onChangeText={(text) => {
            const minutes = text.replace(/\D/g, '').slice(0, 3);
            set('estimatedDurationSeconds')(minutes ? String(Number(minutes) * 60) : '');
          }}
          placeholder="10"
          keyboardType="number-pad"
        />

        <DateField label="날짜" value={form.scheduledDate} onChange={set('scheduledDate')} />

        <TextField
          label="메모 (선택)"
          value={form.memo}
          onChangeText={set('memo')}
          multiline
          maxLength={500}
          error={touched && !memoCheck.ok ? memoCheck.message : null}
        />

        <View style={styles.footer}>
          <Button
            title={editing ? '저장' : '미션 만들기'}
            onPress={submit}
            loading={mutation.isPending}
            disabled={!ready}
            full
          />
          {editing && (
            <Text style={styles.note}>
              분야·난이도·운동을 바꾸려면 이 미션을 취소하고 새로 만들어 주세요.
            </Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: { marginTop: spacing.md, gap: spacing.sm },
  note: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
