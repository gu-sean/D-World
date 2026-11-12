/**
 * 되돌리기 어려운 동작 전에 한 번 더 묻는 창.
 *
 * 목표 삭제·미션 취소·챌린지 포기·탈퇴처럼 누르면 끝인 동작에 쓴다.
 * `danger`를 켜면 확인 버튼이 빨갛게 바뀐다.
 *
 * @param {{
 *   visible: boolean, title: string, message?: string,
 *   confirmText?: string, cancelText?: string,
 *   onConfirm: () => void, onCancel: () => void,
 *   danger?: boolean, loading?: boolean
 * }} props
 */
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import { colors, radius, spacing, typography } from '../theme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttons}>
            <View style={styles.buttonSlot}>
              <Button title={cancelText} variant="secondary" onPress={onCancel} full />
            </View>
            <View style={styles.buttonSlot}>
              <Button
                title={confirmText}
                variant={danger ? 'danger' : 'primary'}
                onPress={onConfirm}
                loading={loading}
                full
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 20, 28, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { ...typography.subtitle, color: colors.text },
  message: { ...typography.body, color: colors.textSub },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  buttonSlot: { flex: 1 },
});
