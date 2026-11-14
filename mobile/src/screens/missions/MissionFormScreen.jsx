// MISSION-10·11 미션 직접 만들기·수정
//
// `missionId`가 있으면 수정, 없으면 새로 만들기다.
// 난이도는 고르지 않는다. 운동 종류·목표 수치·소요 시간을 보고 서버 규칙이 정하고,
// 그 난이도의 보상(관리자 보상표)을 "예상 난이도 · 포인트"로 미리 보여 준다. 보상은 미션마다 받는다.
// 수정일 때 분야·운동 종류는 바꿀 수 없고, 수치를 바꿔 난이도가 달라지면 저장되지 않는다
// (보상이 만들 때 고정되므로 취소하고 새로 만들어야 한다).
//
// 운동을 고르면 목표 단위와 허용 범위가 그 운동의 것으로 바뀌고,
// 범위를 벗어난 값은 보내기 전에 걸러 낸다.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useCreateMission,
  useDifficultyPreview,
  useExerciseTypes,
  useGoal,
  useGoalCategories,
  useMission,
  useUpdateMission,
  validators,
} from '../../client';
import { Button, DateField, ErrorBanner, OptionRow, Screen, TextField } from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function MissionFormScreen({ navigation, route }) {
  const { missionId, goalId, date } = route.params ?? {};
  const editing = Boolean(missionId);

  const categories = useGoalCategories();
  const goal = useGoal(editing ? null : goalId);
  const exercises = useExerciseTypes();
  const existing = useMission(missionId);
  const createMission = useCreateMission();
  const updateMission = useUpdateMission();

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryCode: null,
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
      exerciseCode: m.exerciseCode,
      targetValue: m.targetValue != null ? String(m.targetValue) : '',
      estimatedDurationSeconds: m.estimatedDurationSeconds
        ? String(m.estimatedDurationSeconds)
        : '',
      scheduledDate: m.scheduledDate,
      memo: m.memo ?? '',
    });
  }, [editing, existing.data]);

  // 목표에서 미션을 더할 때는 분야를 목표의 것으로 미리 고른다
  useEffect(() => {
    if (editing || !goal.data?.categoryCode) return;
    setForm((prev) =>
      prev.categoryCode ? prev : { ...prev, categoryCode: goal.data.categoryCode },
    );
  }, [editing, goal.data]);

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
  const isExercise = form.categoryCode === 'exercise';

  // 난이도 미리 보기: 입력이 멈추고 0.4초 뒤에 서버 규칙으로 계산
  const previewInput = useMemo(() => {
    if (!form.categoryCode) return null;
    const input = { categoryCode: form.categoryCode };
    if (isExercise && form.exerciseCode) input.exerciseCode = form.exerciseCode;
    if (form.targetValue && targetCheck.ok) {
      input.targetValue = Number(form.targetValue);
      input.targetUnit = targetUnit;
    }
    if (form.estimatedDurationSeconds) {
      input.estimatedDurationSeconds = Number(form.estimatedDurationSeconds);
    }
    return input;
  }, [
    form.categoryCode,
    form.exerciseCode,
    form.targetValue,
    form.estimatedDurationSeconds,
    isExercise,
    targetUnit,
    targetCheck.ok,
  ]);
  const [debouncedInput, setDebouncedInput] = useState(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(previewInput), 400);
    return () => clearTimeout(timer);
  }, [previewInput]);
  const preview = useDifficultyPreview(debouncedInput);
  const currentDifficulty = editing ? existing.data?.difficultyCode : null;
  const difficultyWillChange =
    editing &&
    touched &&
    !!preview.data &&
    !!currentDifficulty &&
    preview.data.difficultyCode !== currentDifficulty;

  const ready =
    titleCheck.ok && memoCheck.ok && targetCheck.ok && !!form.categoryCode && !difficultyWillChange;

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
          hint={exercise ? `${exercise.minTarget}~${exercise.maxTarget} 사이로 정해 주세요` : null}
        />

        <TextField
          label="예상 소요 시간 (선택, 분)"
          value={
            form.estimatedDurationSeconds ? String(Number(form.estimatedDurationSeconds) / 60) : ''
          }
          onChangeText={(text) => {
            const minutes = text.replace(/\D/g, '').slice(0, 3);
            set('estimatedDurationSeconds')(minutes ? String(Number(minutes) * 60) : '');
          }}
          placeholder="10"
          keyboardType="number-pad"
        />

        <View style={styles.difficultyBox}>
          <Text style={styles.difficultyLabel}>
            {editing ? '난이도 (만들 때 정해졌어요)' : '예상 난이도'}
          </Text>
          {editing ? (
            <Text style={styles.difficultyValue}>
              {labels.difficulty[currentDifficulty] ?? currentDifficulty ?? '-'}
              {existing.data?.reward?.points != null ? ` · ${existing.data.reward.points}P` : ''}
            </Text>
          ) : preview.data ? (
            <>
              <Text style={styles.difficultyValue}>
                {preview.data.difficultyName}
                {preview.data.rewardPoints != null ? ` · ${preview.data.rewardPoints}P` : ''}
              </Text>
              <Text style={styles.difficultyReason}>{preview.data.reason}</Text>
            </>
          ) : (
            <Text style={styles.difficultyReason}>
              {form.categoryCode
                ? '목표 수치와 소요 시간을 보고 정해요'
                : '분야를 고르면 난이도와 보상을 보여 드려요'}
            </Text>
          )}
          {difficultyWillChange && (
            <Text style={styles.difficultyWarn}>
              이렇게 바꾸면 난이도가 '{preview.data.difficultyName}'(으)로 바뀌어요. 보상은 만들 때
              정해져서, 이 미션을 취소하고 새로 만들어 주세요.
            </Text>
          )}
        </View>

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
              분야·운동을 바꾸거나 난이도가 달라지게 고치려면 이 미션을 취소하고 새로 만들어 주세요.
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
  difficultyBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  difficultyLabel: { ...typography.caption, color: colors.textSub },
  difficultyValue: { ...typography.bodyStrong, color: colors.text },
  difficultyReason: { ...typography.caption, color: colors.textSub },
  difficultyWarn: { ...typography.caption, color: colors.danger },
});
