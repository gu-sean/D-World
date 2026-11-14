// MISSION-05 목표 등록·수정
//
// `goalId`가 있으면 수정, 없으면 등록이다. 수정일 때는 시작일과 분야를 바꿀 수 없어서
// 그 두 칸을 잠근 채로 보여 준다 — 이미 만들어진 미션들이 그 값에 묶여 있기 때문이다.
//
// 분야 목록은 서버에서 받아 쓰고, 글자 수와 기간 규칙은 기능 모듈의 검사기로 보내기 전에 걸러 낸다.
// 최종 목표에는 보상이 없어 난이도를 고르지 않는다 (보상은 세부 미션마다, 미션 내용으로 난이도 판정).
// 등록할 때 "AI 계획 받기"와 "직접 계획 짜기" 중 하나를 고른다. 직접 짜면 목표 상세에서 미션을 더한다.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  format,
  useCreateGoal,
  useGoal,
  useGoalCategories,
  useUpdateGoal,
  validators,
} from '../../client';
import { Button, DateField, ErrorBanner, OptionRow, Screen, TextField } from '../../components';
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `주 ${n}회` }));

export default function GoalFormScreen({ navigation, route }) {
  const { goalId } = route.params ?? {};
  const editing = Boolean(goalId);

  const categories = useGoalCategories();
  const existing = useGoal(goalId);
  const createGoal = useCreateGoal();
  const [planMode, setPlanMode] = useState(null); // 'ai' | 'manual' (누른 버튼)
  const updateGoal = useUpdateGoal();

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryCode: null,
    startDate: format.todayKst(),
    endDate: '',
    targetFrequency: '3',
    dailyAvailableMinutes: '',
  });
  const [touched, setTouched] = useState(false);

  // 수정일 때 서버 값으로 칸을 채운다.
  useEffect(() => {
    if (!editing || !existing.data) return;
    const goal = existing.data;
    setForm({
      title: goal.title ?? '',
      description: goal.description ?? '',
      categoryCode: goal.categoryCode,
      startDate: goal.startDate,
      endDate: goal.endDate,
      targetFrequency: goal.targetFrequency ? String(goal.targetFrequency) : '',
      dailyAvailableMinutes: goal.dailyAvailableMinutes ? String(goal.dailyAvailableMinutes) : '',
    });
  }, [editing, existing.data]);

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  };

  const titleCheck = validators.validateLength(form.title, 'goalTitle');
  const descriptionCheck = validators.validateLength(form.description, 'goalDescription');
  const periodCheck = validators.validatePeriod(form.startDate, form.endDate);
  const ready = titleCheck.ok && descriptionCheck.ok && periodCheck.ok && !!form.categoryCode;

  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
    [categories.data],
  );
  const submit = (mode) => {
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      endDate: form.endDate,
      targetFrequency: form.targetFrequency ? Number(form.targetFrequency) : null,
      dailyAvailableMinutes: form.dailyAvailableMinutes ? Number(form.dailyAvailableMinutes) : null,
    };

    if (editing) {
      updateGoal.mutate({ goalId, ...body }, { onSuccess: () => navigation.goBack() });
      return;
    }

    setPlanMode(mode);
    createGoal.mutate(
      { ...body, categoryCode: form.categoryCode, startDate: form.startDate },
      {
        onSuccess: (goal) =>
          mode === 'ai'
            ? navigation.replace(Routes.PLAN_GENERATING, { goalId: goal.id })
            : navigation.replace(Routes.GOAL_DETAIL, { goalId: goal.id }),
      },
    );
  };

  const mutation = editing ? updateGoal : createGoal;

  return (
    <Screen
      title={editing ? '목표 수정' : '새 목표'}
      onBack={() => navigation.goBack()}
      padded={false}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={mutation.error} />

        <TextField
          label="목표"
          value={form.title}
          onChangeText={set('title')}
          placeholder="예) 한 달 안에 스쿼트 50개 하기"
          maxLength={200}
          error={touched && !titleCheck.ok ? titleCheck.message : null}
        />

        <TextField
          label="설명 (선택)"
          value={form.description}
          onChangeText={set('description')}
          placeholder="왜 이루고 싶은지 적어 두면 계획이 더 잘 맞아요"
          maxLength={1000}
          multiline
          error={touched && !descriptionCheck.ok ? descriptionCheck.message : null}
          hint="이름·연락처 같은 개인정보는 적지 마세요."
        />

        <OptionRow
          label={editing ? '분야 (수정할 수 없어요)' : '분야'}
          options={categoryOptions}
          value={form.categoryCode}
          onChange={set('categoryCode')}
          disabled={editing}
        />

        {editing ? (
          <View style={styles.lockedField}>
            <Text style={styles.lockedLabel}>시작일 (수정할 수 없어요)</Text>
            <Text style={styles.lockedValue}>{format.formatDate(form.startDate)}</Text>
          </View>
        ) : (
          <DateField label="시작일" value={form.startDate} onChange={set('startDate')} />
        )}

        <DateField
          label="종료일"
          value={form.endDate}
          onChange={set('endDate')}
          min={form.startDate}
          error={touched && !periodCheck.ok ? periodCheck.message : null}
        />

        <OptionRow
          label="주당 목표 횟수 (선택)"
          options={FREQUENCIES}
          value={form.targetFrequency}
          onChange={set('targetFrequency')}
        />

        <TextField
          label="하루에 쓸 수 있는 시간 (선택, 분)"
          value={form.dailyAvailableMinutes}
          onChangeText={(text) => set('dailyAvailableMinutes')(text.replace(/\D/g, '').slice(0, 3))}
          placeholder="30"
          keyboardType="number-pad"
          hint="5~240분 사이로 적어 주세요"
        />

        <View style={styles.footer}>
          {editing ? (
            <Button
              title="저장"
              onPress={() => submit()}
              loading={mutation.isPending}
              disabled={!ready}
              full
            />
          ) : (
            <>
              <Text style={styles.planHint}>
                세부 미션은 AI가 짜 주거나, 직접 하나씩 적을 수 있어요. 보상은 세부 미션마다
                난이도에 맞춰 받아요.
              </Text>
              <Button
                title="만들고 AI 계획 받기"
                onPress={() => submit('ai')}
                loading={mutation.isPending && planMode === 'ai'}
                disabled={!ready || mutation.isPending}
                full
              />
              <Button
                title="만들고 직접 계획 짜기"
                variant="secondary"
                onPress={() => submit('manual')}
                loading={mutation.isPending && planMode === 'manual'}
                disabled={!ready || mutation.isPending}
                full
              />
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  lockedField: { gap: spacing.xs },
  lockedLabel: { ...typography.caption, color: colors.textSub },
  lockedValue: { ...typography.body, color: colors.textSub },
  footer: { marginTop: spacing.md, gap: spacing.sm },
  planHint: { ...typography.caption, color: colors.textSub },
});
