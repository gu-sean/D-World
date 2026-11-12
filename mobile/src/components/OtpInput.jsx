/**
 * 문자 인증번호 6자리 입력칸.
 *
 * 칸 6개처럼 보이지만 실제 입력은 숨은 입력칸 하나가 받는다. 그래야 붙여넣기와
 * 자동 완성이 그대로 동작한다. 숫자가 아닌 글자는 걸러 낸다.
 *
 * 함께 보여 주는 것
 *   남은 시간   `expiresAt`까지 1초마다 줄어들고, 0이 되면 "시간이 지났어요"로 바뀐다
 *   재전송      `resendAvailableAt` 전에는 남은 초를 보여 주며 눌리지 않는다
 *
 * @param {{
 *   value: string, onChange: (code: string) => void,
 *   expiresAt?: string|null, resendAvailableAt?: string|null,
 *   onResend?: () => void, resending?: boolean
 * }} props
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

const LENGTH = 6;

/** 지금부터 목표 시각까지 남은 초. 지났으면 0. */
function secondsLeft(iso, nowMs) {
  if (!iso) return 0;
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - nowMs) / 1000));
}

function clock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function OtpInput({
  value,
  onChange,
  expiresAt,
  resendAvailableAt,
  onResend,
  resending = false,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remain = useMemo(() => secondsLeft(expiresAt, now), [expiresAt, now]);
  const resendIn = useMemo(() => secondsLeft(resendAvailableAt, now), [resendAvailableAt, now]);
  const digits = (value ?? '').padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  return (
    <View style={styles.wrap}>
      <View>
        <View style={styles.boxes} pointerEvents="none">
          {digits.map((digit, index) => (
            <View
              key={index}
              style={[styles.box, index === (value ?? '').length && styles.boxActive]}>
              <Text style={styles.digit}>{digit.trim()}</Text>
            </View>
          ))}
        </View>

        <TextInput
          style={styles.hidden}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, LENGTH))}
          keyboardType="number-pad"
          maxLength={LENGTH}
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.timer, remain === 0 && styles.timerExpired]}>
          {remain > 0 ? `남은 시간 ${clock(remain)}` : '인증번호 시간이 지났어요'}
        </Text>

        {!!onResend && (
          <TouchableOpacity
            onPress={onResend}
            disabled={resendIn > 0 || resending}
            accessibilityRole="button">
            <Text style={[styles.resend, (resendIn > 0 || resending) && styles.resendOff]}>
              {resendIn > 0 ? `재전송 ${resendIn}초` : '인증번호 다시 받기'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  boxes: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  box: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary },
  digit: { ...typography.title, color: colors.text },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, opacity: 0 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timer: { ...typography.caption, color: colors.textSub },
  timerExpired: { color: colors.danger },
  resend: { ...typography.caption, color: colors.primary },
  resendOff: { color: colors.textSub },
});
