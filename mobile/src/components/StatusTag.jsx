/**
 * 상태를 나타내는 작은 알약 모양 표시.
 *
 * 글자는 반드시 `labels.*`에서 가져온 값을 받는다 — 화면이 '완료' 같은 글자를
 * 직접 적지 않도록 하기 위해서다. `tone`으로 색만 고른다.
 *
 * @param {{text: string, tone?: 'neutral'|'primary'|'success'|'warning'|'danger'}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

const TONES = {
  neutral: { background: '#F1F3F7', label: colors.textSub },
  primary: { background: '#EBF1FF', label: colors.primary },
  success: { background: '#E9FBF0', label: '#15803D' },
  warning: { background: '#FEF6E7', label: '#B45309' },
  danger: { background: '#FEF2F2', label: colors.danger },
};

/** 미션·회차 상태값을 어떤 색으로 보여 줄지 정해 둔 표. */
export const STATUS_TONE = {
  scheduled: 'neutral',
  in_progress: 'primary',
  submitted: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  recording: 'primary',
  uploading: 'primary',
  review_required: 'warning',
  approved: 'success',
  rejected: 'danger',
  superseded: 'neutral',
  aborted: 'neutral',
  active: 'primary',
  paused: 'neutral',
  success: 'success',
  pending: 'warning',
  none: 'neutral',
  enrolled: 'primary',
  withdrawn: 'neutral',
  disqualified: 'danger',
  recruiting: 'primary',
  ongoing: 'success',
  ended: 'neutral',
  received: 'warning',
  in_review: 'primary',
  locked: 'neutral',
  earned: 'success',
};

export default function StatusTag({ text, tone = 'neutral' }) {
  const palette = TONES[tone] ?? TONES.neutral;
  if (!text) return null;

  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.label }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: { ...typography.caption, fontWeight: '600' },
});
