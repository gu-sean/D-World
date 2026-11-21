// MISSION-10·11 미션 직접 만들기·수정
//
// `missionId`가 있으면 수정, 없으면 새로 만들기다.
// 난이도는 고르지 않는다. 보상은 모든 세부 미션이 같아서(30P · 펫 경험치 30) 서버가 준 값을
// "보상" 상자에 그대로 보여 준다. 하루 한도(포인트 120P, 펫 경험치 하루 1번)는 안내만 한다.
// 수정일 때 분야·운동 종류는 바꿀 수 없다. 수치는 고칠 수 있고 보상은 달라지지 않는다.
//
// 운동을 고르면 목표 단위와 허용 범위가 그 운동의 것으로 바뀌고,
// 범위를 벗어난 값은 보내기 전에 걸러 낸다.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  format,
  labels,
  useCancelMission,
  useCreateMission,
  useDifficultyPreview,
  useExerciseTypes,
  useGoal,
  useGoalCategories,
  useMission,
  useUpdateMission,
  validators,
} from '../../client';
import {
  FormScrollView,
  Button,
  DateField,
  ErrorBanner,
  OptionRow,
  Screen,
  TextField,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function MissionFormScreen({ navigation, route }) {
  // replaceMissionId가 있으면 그 러닝 미션을 실내 운동 미션으로 바꾸는 화면이다 (새로 만들고 이전 것은 취소)
  const { missionId, goalId, goalStepId, date, replaceMissionId } = route.params ?? {};
  const editing = Boolean(missionId);
  const replacing = !editing && Boolean(replaceMissionId);

  const categories = useGoalCategories();
  const goal = useGoal(editing ? null : goalId);
  const exercises = useExerciseTypes();
  const existing = useMission(missionId);
  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const cancelMission = useCancelMission();
  // 새 미션은 만들어졌는데 이전 미션 취소가 실패했을 때, 다시 누르면 취소만 다시 시도한다
  const [swapCreated, setSwapCreated] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryCode: replacing ? 'exercise' : null,
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
  // 수정은 이미 정해진 보상을, 새로 만들 때는 서버 미리 보기 값을 보여 준다
  const reward = editing
    ? existing.data?.reward
    : preview.data
      ? { points: preview.data.rewardPoints, petXp: preview.data.rewardPetXp }
      : null;

  const ready = titleCheck.ok && memoCheck.ok && targetCheck.ok && !!form.categoryCode;

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

    const cancelReplaced = () =>
      cancelMission.mutate({ missionId: replaceMissionId }, { onSuccess: () => navigation.goBack() });
    if (replacing && swapCreated) {
      cancelReplaced();
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
        ...(goalStepId ? { goalStepId } : {}),
        memo: form.memo.trim() || null,
      },
      {
        onSuccess: () => {
          if (!replacing) {
            navigation.goBack();
            return;
          }
          setSwapCreated(true);
          cancelReplaced();
        },
      },
    );
  };

  const mutation = editing ? updateMission : createMission;
  const lockedLabel = (text) => `${text}${editing ? ' (수정할 수 없어요)' : ''}`;

  return (
    <Screen
      title={editing ? '미션 수정' : replacing ? '실내 운동으로 바꾸기' : '미션 만들기'}
      onBack={() => navigation.goBack()}
      padded={false}>
      <FormScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={mutation.error} />
        {replacing && <ErrorBanner error={cancelMission.error} />}
        {replacing && (
          <Text style={styles.note}>
            실내 운동 미션을 새로 만들고, 러닝 미션은 취소해요. 난이도와 보상은 새 미션 기준이에요.
          </Text>
        )}

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
          disabled={editing || replacing}
        />

        {isExercise && (
          <OptionRow
            label={lockedLabel('운동 종류')}
            options={(exercises.data ?? [])
              .filter((e) => !replacing || e.code !== 'running')
              .map((e) => ({ value: e.code, label: e.name }))}
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

        <View style={styles.rewardBox}>
          <Text style={styles.rewardLabel}>보상</Text>
          {reward?.points != null ? (
            <Text style={styles.rewardValue}>
              {format.formatPoints(reward.points)} · 펫 경험치 {reward.petXp ?? 0}
            </Text>
          ) : (
            <Text style={styles.rewardNote}>분야를 고르면 보상을 보여 드려요</Text>
          )}
          <Text style={styles.rewardNote}>
            세부 미션마다 같아요. 하루에 포인트는 120P(미션 4개)까지, 펫 경험치는 한 번만 받아요.
            업적·챌린지 보상은 하루 한도와 상관없이 받아요.
          </Text>
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
            title={
              editing
                ? '저장'
                : replacing
                  ? swapCreated
                    ? '이전 미션 취소 다시 시도'
                    : '실내 운동으로 바꾸기'
                  : '미션 만들기'
            }
            onPress={submit}
            loading={mutation.isPending || cancelMission.isPending}
            disabled={!ready}
            full
          />
          {editing && (
            <Text style={styles.note}>
              분야·운동 종류를 바꾸려면 이 미션을 취소하고 새로 만들어 주세요.
            </Text>
          )}
        </View>
      </FormScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: { marginTop: spacing.md, gap: spacing.sm },
  note: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  rewardBox: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rewardLabel: { ...typography.caption, color: colors.textSub },
  rewardValue: { ...typography.bodyStrong, color: colors.text },
  rewardNote: { ...typography.caption, color: colors.textSub },
});
