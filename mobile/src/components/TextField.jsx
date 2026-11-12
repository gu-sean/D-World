/**
 * 글자 입력칸.
 *
 * 라벨·입력칸·도움말/오류 문구를 한 묶음으로 그린다. `error`가 있으면 테두리가
 * 빨개지고 아래에 그 문장이 붙는다. 글자 수 제한이 있는 칸은 `maxLength`를 주면
 * 오른쪽 위에 "12/200"을 보여 준다.
 *
 * @param {{
 *   label?: string, value: string, onChangeText: (text: string) => void,
 *   error?: string|null, hint?: string, placeholder?: string,
 *   secureTextEntry?: boolean, keyboardType?: string, maxLength?: number,
 *   multiline?: boolean, editable?: boolean, autoFocus?: boolean, right?: React.ReactNode
 * }} props
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export default function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  maxLength,
  multiline = false,
  editable = true,
  autoFocus = false,
  right,
}) {
  const length = (value ?? '').length;

  return (
    <View style={styles.wrap}>
      {(label || maxLength) && (
        <View style={styles.labelRow}>
          {!!label && <Text style={styles.label}>{label}</Text>}
          {!!maxLength && (
            <Text style={styles.counter}>
              {length}/{maxLength}
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          !!error && styles.boxError,
          !editable && styles.boxDisabled,
        ]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSub}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {right}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { ...typography.caption, color: colors.textSub },
  counter: { ...typography.caption, color: colors.textSub },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm, minHeight: 110 },
  boxError: { borderColor: colors.danger },
  boxDisabled: { backgroundColor: colors.background },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  inputMultiline: { textAlignVertical: 'top' },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textSub },
});
