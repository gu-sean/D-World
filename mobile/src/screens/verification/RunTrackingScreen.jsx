// 러닝 측정 (VERIFY-01에서 running 미션을 고르면 여기로 온다)
//
// GPS를 잡는 것부터 업로드까지 한 화면에서 이어진다.
//
//   preparing   권한 확인 + 위치 잡는 중
//   ready       준비됨 — 시작 버튼
//   running     거리·페이스·시간·칼로리·케이던스·경로가 실시간으로 바뀐다 (서버와 같은 규칙, runRules)
//   paused      일시정지 (앱이 백그라운드로 가도 자동으로 여기로 온다)
//   finishing~  기록 파일을 만들어 올리고 판정을 기다린다
//
// 화면을 떠나도 측정은 이어진다 — 흐름이 화면 밖에 있기 때문이다.
// 거리는 화면에 보여 주는 값이고, 최종 판정은 서버가 원본 기록으로 따로 계산한다.
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, useMe, useMission, useRunSession } from '../../client';
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  ProgressBar,
  Screen,
} from '../../components';
import goHome from '../../navigation/goHome';
import Routes from '../../navigation/routes';
import { colors, radius, spacing, typography } from '../../theme';
import RunRoute from './RunRoute';

const UPLOAD_MESSAGES = {
  finishing: '기록을 정리하고 있어요',
  uploading: '업로드하고 있어요',
  submitting: '제출하고 있어요',
  waiting: '기록을 확인하고 있어요',
};

export default function RunTrackingScreen({ navigation, route }) {
  const { missionId } = route.params ?? {};
  const mission = useMission(missionId);
  const run = useRunSession(missionId);
  const me = useMe();
  const {
    phase,
    elapsedSeconds,
    activeSeconds,
    distanceMeters,
    steps,
    gpsAccuracyM,
    record,
    error,
    paceSecondsPerKm,
    cadenceSpm,
    calories,
    excludedMeters,
    vehicleNow,
    route: runRoute,
  } = run.state;

  // 칼로리는 프로필 몸무게로 계산한다 (없으면 칼로리 칸을 '-'로)
  const weightKg = me.data?.weightKg ?? null;
  const { setWeightKg } = run;
  useEffect(() => {
    setWeightKg(weightKg);
  }, [setWeightKg, weightKg]);

  const [confirmStop, setConfirmStop] = React.useState(false);

  // 화면에 처음 들어오면 권한 확인과 GPS 잡기를 시작한다.
  useEffect(() => {
    if (phase === 'idle') run.prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 판정이 끝나면 결과 화면으로.
  useEffect(() => {
    if (phase === 'done' && record?.id) {
      navigation.replace(Routes.VERIFY_RESULT, { recordId: record.id });
    }
  }, [phase, record?.id, navigation]);

  const target = mission.data?.targetValue ?? 0;
  const targetUnit = mission.data?.targetUnit ?? 'meters';
  const rate =
    targetUnit === 'meters' && target > 0
      ? distanceMeters / target
      : targetUnit === 'seconds' && target > 0
        ? activeSeconds / target
        : 0;

  // 권한이 막혀 시작도 못 한 경우
  if (phase === 'error' && error?.code === 'PERMISSION_DENIED') {
    return (
      <Screen title="러닝" onBack={() => navigation.goBack()}>
        <View style={styles.center}>
          <Icon name="pin" size={44} color={colors.danger} />
          <Text style={styles.heading}>위치 권한이 필요해요</Text>
          <Text style={styles.description}>러닝은 위치 없이 인증할 수 없어요.</Text>
        </View>
        <View style={styles.footer}>
          <Button
            title="권한 설정하기"
            onPress={() =>
              navigation.replace(Routes.VERIFY_PERMISSION, { missionId, kind: 'location' })
            }
            full
          />
        </View>
      </Screen>
    );
  }

  // 업로드·판정 단계
  if (['finishing', 'uploading', 'submitting', 'waiting'].includes(phase)) {
    return (
      <Screen title="인증 중">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.heading}>{UPLOAD_MESSAGES[phase]}</Text>
          {phase === 'uploading' && (
            <View style={styles.uploadProgress}>
              <ProgressBar rate={run.state.progress} />
            </View>
          )}
          <Text style={styles.description}>화면을 닫아도 계속 진행돼요.</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'pending') {
    return (
      <Screen title="확인 중">
        <View style={styles.center}>
          <Icon name="clock" size={48} color={colors.warning} />
          <Text style={styles.heading}>결과가 조금 늦어지고 있어요</Text>
          <Text style={styles.description}>끝나면 알림으로 알려 드릴게요.</Text>
        </View>
        <View style={styles.footer}>
          <Button title="홈으로" onPress={() => goHome(navigation)} full />
        </View>
      </Screen>
    );
  }

  const measuring = phase === 'running' || phase === 'paused';

  return (
    <Screen title={mission.data?.title ?? '러닝'} onBack={measuring ? undefined : () => navigation.goBack()}>
      <ErrorBanner error={phase === 'error' ? error : null} />

      <View style={styles.center}>
        {phase === 'preparing' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.heading}>위치를 잡고 있어요</Text>
            <Text style={styles.description}>하늘이 보이는 곳에서 잠시 기다려 주세요.</Text>
          </>
        )}

        {phase === 'ready' && (
          <>
            <Icon name="pin" size={44} color={colors.primary} />
            <Text style={styles.heading}>준비됐어요</Text>
            <Text style={styles.description}>
              {gpsAccuracyM != null
                ? `위치 정확도 약 ${Math.round(gpsAccuracyM)}m`
                : '위치를 아직 잡는 중이에요'}
            </Text>
            {!!error && error.code === 'GPS_UNAVAILABLE' && (
              <Text style={styles.warn}>
                신호가 약해요. 그대로 시작할 수 있지만 기록이 덜 정확할 수 있어요.
              </Text>
            )}
          </>
        )}

        {measuring && (
          <ScrollView style={styles.measureScroll} contentContainerStyle={styles.measure}>
            <View style={styles.distanceBox}>
              <Text style={styles.distance}>{(distanceMeters / 1000).toFixed(2)}</Text>
              <Text style={styles.distanceUnit}>킬로미터 · 목표 {format.formatTarget(target, targetUnit)}</Text>
            </View>

            <View style={styles.progressBox}>
              <ProgressBar rate={rate} height={10} />
            </View>

            {vehicleNow && (
              <View style={styles.vehicleBox}>
                <Text style={styles.vehicleText}>
                  탈것으로 이동 중인 것 같아요. 이 구간은 거리에서 빠져요.
                </Text>
              </View>
            )}

            <View style={styles.grid}>
              <Stat label="페이스" value={format.formatPace(paceSecondsPerKm)} />
              <Stat label="시간" value={format.formatDuration(activeSeconds)} />
              <Stat label="칼로리" value={calories == null ? '-' : format.formatNumber(Math.round(calories))} />
            </View>
            <View style={styles.grid}>
              <Stat label="케이던스" value={cadenceSpm == null ? '-' : format.formatNumber(Math.round(cadenceSpm))} />
              <Stat label="걸음" value={format.formatNumber(steps)} />
              <Stat label="전체 시간" value={format.formatDuration(elapsedSeconds)} />
            </View>

            {excludedMeters > 0 && (
              <Text style={styles.warn}>탈것으로 보여 뺀 거리 {format.formatDistance(excludedMeters)}</Text>
            )}
            {calories == null && (
              <Text style={styles.description}>마이 &gt; 프로필에 몸무게를 넣으면 칼로리를 계산해요.</Text>
            )}

            <RunRoute points={runRoute} />

            {phase === 'paused' && <Text style={styles.warn}>일시정지 중이에요</Text>}
          </ScrollView>
        )}
      </View>

      <View style={styles.footer}>
        {phase === 'ready' && <Button title="러닝 시작" onPress={() => run.start()} full />}

        {phase === 'running' && (
          <View style={styles.row}>
            <View style={styles.slot}>
              <Button title="일시정지" variant="secondary" onPress={() => run.pause()} full />
            </View>
            <View style={styles.slot}>
              <Button title="종료" onPress={() => setConfirmStop(true)} full />
            </View>
          </View>
        )}

        {phase === 'paused' && (
          <View style={styles.row}>
            <View style={styles.slot}>
              <Button title="이어서 하기" onPress={() => run.resume()} full />
            </View>
            <View style={styles.slot}>
              <Button title="종료" variant="secondary" onPress={() => setConfirmStop(true)} full />
            </View>
          </View>
        )}

        {phase === 'error' && error?.code !== 'PERMISSION_DENIED' && (
          <>
            <Button title="다시 보내기" onPress={() => run.retryUpload()} full />
            <Button
              title="그만두기"
              variant="text"
              onPress={() => {
                run.cancel();
                navigation.goBack();
              }}
              full
            />
          </>
        )}
      </View>

      <ConfirmDialog
        visible={confirmStop}
        title="러닝을 끝낼까요?"
        message="지금까지 기록한 내용으로 인증을 요청해요."
        confirmText="끝내고 인증"
        onConfirm={() => {
          setConfirmStop(false);
          run.finish();
        }}
        onCancel={() => setConfirmStop(false)}
      />
    </Screen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  heading: { ...typography.subtitle, color: colors.text, textAlign: 'center' },
  description: { ...typography.caption, color: colors.textSub, textAlign: 'center' },
  warn: { ...typography.caption, color: colors.warning, textAlign: 'center' },
  measureScroll: { alignSelf: 'stretch' },
  measure: { gap: spacing.md, paddingVertical: spacing.md },
  distanceBox: { alignItems: 'flex-start' },
  distance: { ...typography.figure, fontSize: 72, lineHeight: 80, fontStyle: 'italic', fontWeight: '900', color: colors.text },
  distanceUnit: { ...typography.caption, color: colors.textSub },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  vehicleBox: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.sm },
  vehicleText: { ...typography.caption, color: colors.warningText },
  progressBox: { alignSelf: 'stretch' },
  uploadProgress: { alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'flex-start', gap: 2 },
  statValue: { ...typography.subtitle, fontSize: 22, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSub },
  footer: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1 },
});
