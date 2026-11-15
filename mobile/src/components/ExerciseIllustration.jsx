/**
 * 운동 자세 그림.
 *
 * `assets/exercisePoses.js`의 관절 좌표를 선으로 이어 사람 모양을 그린다.
 * - `variant="thumbnail"`: 대표 장면 하나 (미션 카드 왼쪽)
 * - `variant="sequence"`: 장면을 순서대로 나란히, 아래에 동작 이름 (미션 상세·촬영 안내)
 *
 * 운동 코드가 없거나 모르는 값이면 아무것도 그리지 않는다(직접 만든 일반 미션 등).
 *
 * @param {{exerciseCode?: string|null, variant?: 'thumbnail'|'sequence', size?: number}} props
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Polyline, Rect } from 'react-native-svg';

import EXERCISE_POSES from '../assets/exercisePoses';
import Icon from './Icon';
import { colors, spacing, typography } from '../theme';

const VIEW_W = 120;
const VIEW_H = 100;
const FLOOR_Y = 88.5;

const FAR_ARM = ['shoulder', 'elbowF', 'wristF'];
const FAR_LEG = ['hip', 'kneeF', 'ankleF', 'toeF'];
const TORSO = ['neck', 'shoulder', 'hip'];
const NEAR_LEG = ['hip', 'kneeN', 'ankleN', 'toeN'];
const NEAR_ARM = ['shoulder', 'elbowN', 'wristN'];

const points = (pose, keys) =>
  keys
    .filter((key) => pose[key])
    .map((key) => pose[key].join(','))
    .join(' ');

function Figure({ frame, color, height }) {
  const { pose, airborne } = frame;
  const xs = Object.values(pose).map(([x]) => x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const shadowRx = ((right - left) / 2 + 6) * (airborne ? 0.6 : 1);

  const limb = (keys, width, opacity) => (
    <Polyline
      points={points(pose, keys)}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <Svg width={(height * VIEW_W) / VIEW_H} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={14} fill={color} fillOpacity={0.1} />
      <Line
        x1={8}
        y1={FLOOR_Y}
        x2={VIEW_W - 8}
        y2={FLOOR_Y}
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Ellipse
        cx={(left + right) / 2}
        cy={90}
        rx={shadowRx}
        ry={2.6}
        fill={color}
        fillOpacity={airborne ? 0.1 : 0.16}
      />
      {limb(FAR_ARM, 6, 0.4)}
      {limb(FAR_LEG, 6.5, 0.4)}
      {limb(TORSO, 9, 1)}
      {limb(NEAR_LEG, 7, 1)}
      {limb(NEAR_ARM, 6.5, 1)}
      <Circle cx={pose.head[0]} cy={pose.head[1]} r={7} fill={color} />
    </Svg>
  );
}

export default function ExerciseIllustration({ exerciseCode, variant = 'thumbnail', size }) {
  const exercise = exerciseCode ? EXERCISE_POSES[exerciseCode] : null;
  if (!exercise) return null;
  const color = colors.exercise?.[exerciseCode] ?? colors.primary;

  if (variant === 'thumbnail') {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel="운동 자세 그림">
        <Figure frame={exercise.frames[exercise.thumbnail]} color={color} height={size ?? 48} />
      </View>
    );
  }

  // 장면이 많을수록 작게 그려 360dp 폰의 카드 안(약 296dp)에 한 줄로 들어가게 한다
  const count = exercise.frames.length;
  const height = size ?? (count >= 3 ? 68 : count === 2 ? 96 : 120);
  const labelWidth = (height * VIEW_W) / VIEW_H;
  const description = exercise.frames.map((frame) => frame.label).join(', ');

  return (
    <View
      style={styles.sequence}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`운동 자세 그림: ${description}`}>
      {exercise.frames.map((frame, index) => (
        <React.Fragment key={frame.label}>
          {index > 0 && <Icon name="chevronRight" size={14} color={colors.textSub} />}
          <View style={styles.step}>
            <Figure frame={frame} color={color} height={height} />
            <Text style={[styles.label, { maxWidth: labelWidth }]}>{frame.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sequence: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  step: { alignItems: 'center', gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
});
