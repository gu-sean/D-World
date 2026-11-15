// MISSION-05 목표 등록·수정
//
// `goalId`가 있으면 수정, 없으면 등록이다. 수정일 때는 시작일과 분야를 바꿀 수 없어서
// 그 두 칸을 잠근 채로 보여 준다 — 이미 만들어진 미션들이 그 값에 묶여 있기 때문이다.
//
// 분야 목록은 서버에서 받아 쓰고, 글자 수와 기간 규칙은 기능 모듈의 검사기로 보내기 전에 걸러 낸다.
// 최종 목표에는 보상이 없어 난이도를 고르지 않는다 (보상은 세부 미션마다, 미션 내용으로 난이도 판정).
// 등록할 때 "AI 계획 받기"와 "직접 계획 짜기" 중 하나를 고른다. 직접 짜면 목표 상세에서 미션을 더한다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';

import {
  format,
  useCreateGoal,
  useDifficultyLevels,
  useDifficultyRecommendation,
  useGoal,
  useGoalCategories,
  useUpdateGoal,
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
import Routes from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme';

const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `주 ${n}회` }));

export default function GoalFormScreen({ navigation, route }) {
  const { goalId, aiRecommended = false } = route.params ?? {};
  const editing = Boolean(goalId);

  const categories = useGoalCategories();
  const difficulties = useDifficultyLevels();
  const existing = useGoal(goalId);
  const createGoal = useCreateGoal();
  const [planMode, setPlanMode] = useState(null); // 'ai' | 'manual' (누른 버튼)
  const updateGoal = useUpdateGoal();
  const difficultyRecommendation = useDifficultyRecommendation();
  const recommendationStarted = useRef(false);
  const presetApplied = useRef(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryCode: null,
    difficultyCode: null,
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
      difficultyCode: goal.difficultyCode,
      startDate: goal.startDate,
      endDate: goal.endDate,
      targetFrequency: goal.targetFrequency ? String(goal.targetFrequency) : '',
      dailyAvailableMinutes: goal.dailyAvailableMinutes ? String(goal.dailyAvailableMinutes) : '',
    });
  }, [editing, existing.data]);

  useEffect(() => {
    if (editing || recommendationStarted.current) return;
    recommendationStarted.current = true;
    difficultyRecommendation.mutate(
      { mode: aiRecommended ? 'ai_recommendation' : 'manual' },
      {
        onSuccess: (result) =>
          setForm((prev) => ({
            ...prev,
            difficultyCode: prev.difficultyCode ?? result.recommendedDifficultyCode,
          })),
      },
    );
  }, [aiRecommended, difficultyRecommendation, editing]);

  useEffect(() => {
    if (
      editing ||
      !aiRecommended ||
      presetApplied.current ||
      !difficultyRecommendation.data ||
      !(categories.data ?? []).length
    ) {
      return;
    }
    presetApplied.current = true;
    const recommended = difficultyRecommendation.data.recommendedDifficultyCode;
    const suggested = difficultyRecommendation.data.suggestedGoal;
    const settings = {
      easy: { frequency: '3', minutes: '15' },
      normal: { frequency: '4', minutes: '25' },
      hard: { frequency: '5', minutes: '35' },
    }[recommended] ?? { frequency: '3', minutes: '20' };
    const category =
      (categories.data ?? []).find(
        (item) => item.code === (suggested?.categoryCode ?? 'exercise'),
      ) ?? categories.data[0];
    setForm((current) => ({
      ...current,
      title: suggested?.title ?? '한 달 운동 습관 만들기',
      description:
        suggested?.description ?? 'AI가 회원정보와 최근 수행 기록을 바탕으로 추천한 시작 목표예요.',
      categoryCode: category.code,
      difficultyCode: suggested?.difficultyCode ?? recommended,
      startDate: format.todayKst(),
      endDate: dayjs(format.todayKst())
        .add(suggested?.durationDays ?? 30, 'day')
        .format('YYYY-MM-DD'),
      targetFrequency: String(suggested?.targetFrequency ?? settings.frequency),
      dailyAvailableMinutes: String(suggested?.dailyAvailableMinutes ?? settings.minutes),
    }));
  }, [aiRecommended, categories.data, difficultyRecommendation.data, editing]);

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  };

  const titleCheck = validators.validateLength(form.title, 'goalTitle');
  const descriptionCheck = validators.validateLength(form.description, 'goalDescription');
  const periodCheck = validators.validatePeriod(form.startDate, form.endDate);
  const ready =
    titleCheck.ok &&
    descriptionCheck.ok &&
    periodCheck.ok &&
    !!form.categoryCode &&
    !!form.difficultyCode;

  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.code, label: c.name })),
    [categories.data],
  );
  const difficultyOptions = useMemo(
    () => (difficulties.data ?? []).map((d) => ({ value: d.code, label: d.name })),
    [difficulties.data],
  );

  const chooseDifficulty = (requestedDifficultyCode) => {
    set('difficultyCode')(requestedDifficultyCode);
    difficultyRecommendation.mutate(
      {
        mode: 'manual',
        requestedDifficultyCode,
        targetFrequency: form.targetFrequency ? Number(form.targetFrequency) : undefined,
        dailyAvailableMinutes: form.dailyAvailableMinutes
          ? Number(form.dailyAvailableMinutes)
          : undefined,
      },
      {
        onSuccess: (result) =>
          setForm((prev) => ({ ...prev, difficultyCode: result.recommendedDifficultyCode })),
      },
    );
  };

  const persistGoal = (mode, difficultyCode) => {
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      difficultyCode,
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

  const submit = (mode) => {
    setPlanMode(mode);
    difficultyRecommendation.mutate(
      {
        mode: aiRecommended ? 'ai_recommendation' : 'manual',
        requestedDifficultyCode: form.difficultyCode,
        targetFrequency: form.targetFrequency ? Number(form.targetFrequency) : undefined,
        dailyAvailableMinutes: form.dailyAvailableMinutes
          ? Number(form.dailyAvailableMinutes)
          : undefined,
      },
      {
        onSuccess: (result) => {
          setForm((current) => ({
            ...current,
            difficultyCode: result.recommendedDifficultyCode,
          }));
          persistGoal(mode, result.recommendedDifficultyCode);
        },
      },
    );
  };

  const mutation = editing ? updateGoal : createGoal;

  return (
    <Screen
      title={editing ? '목표 수정' : '새 목표'}
      onBack={() => navigation.goBack()}
      padded={false}>
      <FormScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ErrorBanner error={mutation.error ?? difficultyRecommendation.error} />

        {aiRecommended && (
          <View style={styles.aiPreset}>
            <Text style={styles.aiPresetTitle}>AI 추천 목표</Text>
            <Text style={styles.aiPresetText}>
              회원정보와 최근 수행 기록을 바탕으로 시작하기 좋은 목표를 채웠어요. 원하는 내용은
              자유롭게 수정할 수 있어요.
            </Text>
          </View>
        )}

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

        {!!difficultyRecommendation.data && (
          <View style={styles.aiHint}>
            <Text style={styles.aiHintTitle}>
              에이전트 권장 ·{' '}
              {
                { easy: '쉬움', normal: '보통', hard: '어려움' }[
                  difficultyRecommendation.data.recommendedDifficultyCode
                ]
              }
            </Text>
            <Text style={styles.aiHintText}>{difficultyRecommendation.data.reason}</Text>
            <Text style={styles.agentChain}>프로필 분석 → 최근 수행 기록 → 안전 검토</Text>
          </View>
        )}

        <OptionRow
          label="목표 난이도"
          options={difficultyOptions}
          value={form.difficultyCode}
          onChange={chooseDifficulty}
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
              loading={mutation.isPending || difficultyRecommendation.isPending}
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
                loading={
                  (mutation.isPending || difficultyRecommendation.isPending) && planMode === 'ai'
                }
                disabled={!ready || mutation.isPending}
                full
              />
              <Button
                title="만들고 직접 계획 짜기"
                variant="secondary"
                onPress={() => submit('manual')}
                loading={
                  (mutation.isPending || difficultyRecommendation.isPending) &&
                  planMode === 'manual'
                }
                disabled={!ready || mutation.isPending}
                full
              />
            </>
          )}
        </View>
      </FormScrollView>
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
  aiPreset: {
    padding: spacing.lg,
    borderRadius: 14,
    backgroundColor: '#F5F8FF',
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  aiPresetTitle: { ...typography.bodyStrong, color: colors.primary },
  aiPresetText: { ...typography.caption, color: colors.textSub },
  aiHint: { padding: spacing.md, borderRadius: 12, backgroundColor: '#EBF1FF', gap: spacing.xs },
  aiHintTitle: { ...typography.bodyStrong, color: colors.primary },
  aiHintText: { ...typography.caption, color: colors.textSub },
  agentChain: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
