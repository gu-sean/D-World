/**
 * 데이터를 가져오는 화면이 거치는 네 가지 상태를 한 자리에서 처리한다.
 *
 *   불러오는 중   돌아가는 표시
 *   오류          서버가 준 문장 + "다시 시도" (권한 문제면 다시 시도를 주지 않는다)
 *   결과 없음     안내 문구
 *   정상          `children(data)` 를 그린다
 *
 * 목록 훅처럼 `items`를 따로 주는 경우에는 `data`로 넘긴다.
 *
 * @param {{
 *   query: {isLoading: boolean, isError: boolean, error?: any, data?: any, refetch?: () => void},
 *   data?: any, isEmpty?: boolean, emptyTitle?: string, emptyText?: string,
 *   children: (data: any) => React.ReactNode
 * }} props
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import EmptyState from './EmptyState';
import Icon from './Icon';
import { colors, spacing, typography } from '../theme';

/** 다시 시도해도 결과가 같은 오류들 — 버튼을 주지 않는다. */
const NO_RETRY_CODES = ['PERMISSION_DENIED', 'COMMON_FORBIDDEN', 'COMMON_NOT_FOUND', 'COMMON_NOT_IMPLEMENTED'];

export default function QueryState({
  query,
  data,
  isEmpty,
  emptyTitle = '아직 아무것도 없어요',
  emptyText,
  children,
}) {
  const value = data !== undefined ? data : query?.data;

  if (query?.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (query?.isError) {
    const code = query.error?.code;
    const canRetry = !NO_RETRY_CODES.includes(code) && typeof query.refetch === 'function';
    return (
      <View style={styles.center}>
        <Icon name="alert" size={32} color={colors.textSub} />
        <Text style={styles.errorText}>{query.error?.message ?? '잠시 후 다시 시도해 주세요.'}</Text>
        {canRetry && (
          <View style={styles.retry}>
            <Button title="다시 시도" variant="secondary" onPress={() => query.refetch()} />
          </View>
        )}
      </View>
    );
  }

  const empty =
    isEmpty !== undefined
      ? isEmpty
      : value === null || value === undefined || (Array.isArray(value) && value.length === 0);

  if (empty) {
    return <EmptyState title={emptyTitle} description={emptyText} />;
  }

  return children(value);
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorText: { ...typography.body, color: colors.textSub, textAlign: 'center' },
  retry: { marginTop: spacing.xs },
});
