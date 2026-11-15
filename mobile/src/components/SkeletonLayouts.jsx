/**
 * 화면 종류별 스켈레톤 모양.
 *
 *   card     카드 목록 (챌린지·목표)
 *   grid     2열 카드 (펫 도감)
 *   row      줄 목록 (포인트 내역·알림함·공지)
 *   summary  요약 카드 + 구역 (홈·리포트)
 *
 * `QueryState`의 `skeleton` 값으로 고른다. 실제 화면의 여백·카드 모양과 맞춰 두어
 * 데이터가 오면 자리가 거의 그대로 채워진다.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import Card from './Card';
import Skeleton, { Bone } from './Skeleton';
import { colors, spacing } from '../theme';

function CardBones() {
  return (
    <Card style={styles.card}>
      <View style={styles.chips}>
        <Bone width={52} height={22} round />
        <Bone width={110} height={22} round />
      </View>
      <Bone width="55%" height={20} />
      <Bone width="90%" height={13} />
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Bone width="62%" height={13} />
        </View>
        <Bone width={96} height={26} round />
      </View>
    </Card>
  );
}

function GridBones() {
  const cell = (key) => (
    <Card key={key} style={styles.cell}>
      <Bone width={72} height={72} round />
      <Bone width={56} height={16} />
      <Bone width={64} height={22} round />
      <Bone width={92} height={24} round />
    </Card>
  );
  return (
    <View style={styles.grid}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.gridRow}>
          {cell(`${row}a`)}
          {cell(`${row}b`)}
        </View>
      ))}
    </View>
  );
}

function RowBones() {
  return (
    <View style={styles.rows}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.row}>
          <Bone width={36} height={36} round />
          <View style={styles.rowTexts}>
            <Bone width="55%" height={15} />
            <Bone width="35%" height={12} />
          </View>
          <Bone width={44} height={15} />
        </View>
      ))}
    </View>
  );
}

function SummaryBones() {
  return (
    <View style={styles.summary}>
      <Card style={styles.summaryCard}>
        <Bone width={92} height={92} round />
        <View style={styles.summaryTexts}>
          <Bone width="60%" height={20} />
          <Bone width="80%" height={13} />
          <Bone width="45%" height={13} />
        </View>
      </Card>
      <Bone width={110} height={20} style={styles.sectionTitle} />
      <Card style={styles.card}>
        <Bone width="100%" height={14} />
        <Bone width="100%" height={8} round />
        <Bone width="100%" height={14} />
        <Bone width="100%" height={8} round />
      </Card>
    </View>
  );
}

const LAYOUTS = { card: CardBones, grid: GridBones, row: RowBones, summary: SummaryBones };

export default function SkeletonLayout({ variant }) {
  const Layout = LAYOUTS[variant];
  if (!Layout) return null;
  const list = variant === 'card' ? [0, 1, 2] : [0];
  return (
    <Skeleton style={styles.root}>
      {list.map((i) => (
        <Layout key={i} />
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing.lg, gap: spacing.sm },
  card: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  footerLeft: { flex: 1 },
  grid: { gap: spacing.sm },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1, alignItems: 'center', gap: spacing.xs },
  rows: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTexts: { flex: 1, gap: spacing.xs },
  summary: { gap: spacing.lg },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryTexts: { flex: 1, gap: spacing.sm },
  sectionTitle: { marginTop: spacing.xs },
});
