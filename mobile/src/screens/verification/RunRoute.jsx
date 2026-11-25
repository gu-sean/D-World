// 달린 경로 그리기
//   네이버 지도 Client ID(.env NAVER_MAP_CLIENT_ID)가 있으면 지도 위에 경로를,
//   없으면 지도 없이 선만 그린다 (SVG).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  NaverMapCircleOverlay,
  NaverMapPathOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';

import { config } from '../../client/config';
import Icon from '../../components/Icon';
import { colors, radius, spacing, typography } from '../../theme';

const PAD = 14;
/** 지도에 보일 최소 범위 (m). 막 시작했을 때 너무 확대되지 않게 */
const MAP_MIN_SPAN_M = 300;
/** 확대·축소 한계 (네이버 지도 줌 레벨). 너무 멀리·가까이 가서 경로를 잃지 않게 */
const MIN_ZOOM = 10;
const MAX_ZOOM = 19;
/** 출발·도착 점의 화면 반지름 (dp). 줌이 바뀌어도 이 크기로 보이게 m 단위 반지름을 다시 구한다 */
const DOT_DP = 6;
/** 출발·도착 점의 전역 z 순서: 0 이상이면 지도 아이콘 위 (경로선 -100000, 원 기본값 -200000) */
const DOT_GLOBAL_Z = 150000;
/**
 * 지구 둘레 (m). 네이버 지도 줌 레벨 z에서 1dp ≈ 둘레 × cos(위도) / 2^(z+9) m
 * (일반 256 타일 기준식 2^(z+8)로 두면 실제 폰에서 점이 2배로 그려졌다 — Z Fold 420dpi에서 확인)
 */
const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** 경로 점들이 모두 보이는 지도 범위 (네이버 지도 Region: 남서쪽 모서리 + 폭) */
function fitRegion(points) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const kx = Math.cos((minLat * Math.PI) / 180);
  const minLatSpan = MAP_MIN_SPAN_M / 111320;
  const latSpan = Math.max(maxLat - minLat, minLatSpan) * 1.3;
  const lngSpan = Math.max(maxLng - minLng, minLatSpan / kx) * 1.3;
  return {
    latitude: (minLat + maxLat) / 2 - latSpan / 2,
    longitude: (minLng + maxLng) / 2 - lngSpan / 2,
    latitudeDelta: latSpan,
    longitudeDelta: lngSpan,
  };
}

/** 줌 레벨에서 화면 dp만큼의 길이 (m) */
function metersForDp(dp, zoom, latitude) {
  return (dp * EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / 2 ** (zoom + 9);
}

/**
 * @param {{points: Array<{lat: number, lng: number}>, height?: number}} props
 */
export default function RunRoute({ points, height = 220 }) {
  if (!points || points.length < 2) {
    return (
      <View style={[styles.box, styles.empty, { height }]}>
        <Text style={styles.hint}>달리기 시작하면 경로가 그려져요</Text>
      </View>
    );
  }
  if (config.NAVER_MAP_CLIENT_ID) return <RouteMap points={points} height={height} />;
  return <RouteLine points={points} height={height} />;
}

/**
 * 네이버 지도 위 경로.
 * - 처음에는 경로 전체가 보이게 맞추고, 새 위치가 들어올 때마다 다시 맞춘다 (자동 맞춤).
 * - 두 손가락으로 확대·축소하거나 +/− 버튼을 누르면 자동 맞춤을 멈추고 그 크기를 유지한다.
 *   '전체 경로'를 누르면 다시 자동 맞춤으로 돌아간다.
 * - 한 손가락으로 끌어 옮기기·회전·기울이기는 끈다 (지도가 세로 스크롤 화면 안에 있어 끌기가 스크롤과 겹친다).
 * - 지도의 카메라는 `region`으로 매번 고정하지 않고(그러면 확대해도 바로 되돌아간다),
 *   처음 한 번 `initialRegion`으로 맞춘 뒤 ref로 움직인다.
 */
function RouteMap({ points, height }) {
  const mapRef = useRef(null);
  // 마지막으로 본 카메라 (+/− 버튼이 현재 중심·줌에서 한 단계씩 움직이도록)
  const cameraRef = useRef(null);
  const [follow, setFollow] = useState(true);
  const [zoom, setZoom] = useState(null);

  const region = useMemo(() => fitRegion(points), [points]);
  const [initialRegion] = useState(region);

  // 자동 맞춤 중이면 새 경로가 들어올 때마다 전체가 보이게 다시 맞춘다
  useEffect(() => {
    if (follow) mapRef.current?.animateRegionTo({ ...region, duration: 300 });
  }, [follow, region]);

  // 점 크기를 줌에 맞추되, 줌이 0.25 이상 바뀔 때만 다시 그린다 (카메라가 움직이는 매 프레임마다 그리지 않게)
  const updateZoom = (next) => {
    if (next == null) return;
    setZoom((prev) => (prev == null || Math.abs(prev - next) >= 0.25 ? next : prev));
  };

  const onCameraChanged = (camera) => {
    cameraRef.current = camera;
    updateZoom(camera.zoom);
    // 앱이 움직인 것(Developer)은 무시하고, 사용자가 손가락으로 움직인 것만 자동 맞춤을 멈춘다
    if (camera.reason === 'Gesture' || camera.reason === 'Control') setFollow(false);
  };

  const zoomBy = (delta) => {
    const camera = cameraRef.current;
    if (!camera) return;
    setFollow(false);
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (camera.zoom ?? 15) + delta));
    mapRef.current?.animateCameraTo({
      latitude: camera.latitude,
      longitude: camera.longitude,
      zoom: next,
      duration: 200,
    });
  };

  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  // 원 반지름은 m 단위라, 지금 줌에서 화면에 DOT_DP 크기로 보이게 한다 (줌을 모를 때는 지도 범위로 어림)
  const dot =
    zoom != null
      ? metersForDp(DOT_DP, zoom, coords[0].latitude)
      : Math.max(6, region.latitudeDelta * 111320 * 0.02);
  const start = coords[0];
  const end = coords[coords.length - 1];

  return (
    <View style={[styles.box, { height }]} accessibilityLabel="달린 경로 지도">
      <NaverMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        isScrollGesturesEnabled={false}
        isZoomGesturesEnabled
        isTiltGesturesEnabled={false}
        isRotateGesturesEnabled={false}
        isShowZoomControls={false}
        isShowLocationButton={false}
        isShowCompass={false}
        isShowScaleBar={false}
        onCameraChanged={onCameraChanged}
        onCameraIdle={(camera) => {
          cameraRef.current = camera;
          if (camera.zoom != null) setZoom(camera.zoom);
        }}
      >
        <NaverMapPathOverlay
          coords={coords}
          width={6}
          color={colors.primary}
          outlineWidth={1}
          outlineColor={colors.onPrimary}
        />
        {/* 원은 기본으로 경로선·지도 아이콘(역·공원 등) 아래에 그려져 가려지므로 둘 다보다 위로 올린다 */}
        <NaverMapCircleOverlay {...start} radius={dot} color={colors.success} outlineWidth={2} outlineColor={colors.onPrimary} globalZIndex={DOT_GLOBAL_Z} />
        <NaverMapCircleOverlay {...end} radius={dot * 1.2} color={colors.danger} outlineWidth={2} outlineColor={colors.onPrimary} globalZIndex={DOT_GLOBAL_Z} />
      </NaverMapView>

      {!follow && (
        <TouchableOpacity
          style={[styles.mapButton, styles.fitButton]}
          onPress={() => setFollow(true)}
          accessibilityRole="button"
          accessibilityLabel="전체 경로 보기"
          hitSlop={4}>
          <Icon name="fitRoute" size={24} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      )}

      <View style={styles.zoomBox}>
        <TouchableOpacity
          style={[styles.mapButton, styles.zoomButton]}
          onPress={() => zoomBy(1)}
          accessibilityRole="button"
          accessibilityLabel="지도 확대"
          hitSlop={4}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity
          style={[styles.mapButton, styles.zoomButton]}
          onPress={() => zoomBy(-1)}
          accessibilityRole="button"
          accessibilityLabel="지도 축소"
          hitSlop={4}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** 지도 없이 선만 */
function RouteLine({ points, height }) {
  const [width, setWidth] = React.useState(0);

  // 위도·경도를 미터 비율로 맞춰 화면에 넣는다 (경도 1도는 위도에 따라 짧아진다)
  const lat0 = points[0].lat;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * kx);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const innerW = Math.max(1, width - PAD * 2);
  const innerH = height - PAD * 2;
  // 최소 50m 축척: 제자리 GPS 흔들림 몇 m가 상자를 꽉 채운 긴 선으로 보이지 않게
  const MIN_SPAN_DEG = 50 / 111320;
  const scale = Math.min(innerW / Math.max(spanX, MIN_SPAN_DEG), innerH / Math.max(spanY, MIN_SPAN_DEG));
  const offX = PAD + (innerW - spanX * scale) / 2;
  const offY = PAD + (innerH - spanY * scale) / 2;
  const toXY = (i) => [offX + (xs[i] - minX) * scale, offY + (maxY - ys[i]) * scale];
  const coords = points.map((_, i) => toXY(i));
  const [sx, sy] = coords[0];
  const [ex, ey] = coords[coords.length - 1];

  return (
    <View
      style={[styles.box, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="달린 경로"
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Polyline
            points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={colors.primary}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={sx} cy={sy} r={6} fill={colors.success} />
          <Circle cx={ex} cy={ey} r={7} fill={colors.danger} stroke="#fff" strokeWidth={2} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    backgroundColor: colors.neutralSoft,
    overflow: 'hidden',
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  hint: { ...typography.caption, color: colors.textSub },
  // 지도 위 버튼: 달리면서도 누르기 쉽게 44dp 이상
  mapButton: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBox: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomButton: { width: 44, height: 44 },
  zoomDivider: { height: 1, backgroundColor: colors.border },
  zoomText: { fontSize: 22, lineHeight: 26, fontWeight: '600', color: colors.text },
  // '전체 경로 보기': +/− 버튼과 같은 44dp 네모, 그 바로 위에 둔다
  fitButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm + 44 * 2 + 1 + spacing.sm,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
