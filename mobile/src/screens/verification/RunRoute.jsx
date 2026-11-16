// 달린 경로 그리기
//   네이버 지도 Client ID(.env NAVER_MAP_CLIENT_ID)가 있으면 지도 위에 경로를,
//   없으면 지도 없이 선만 그린다 (SVG).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  NaverMapCircleOverlay,
  NaverMapPathOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';

import { config } from '../../client/config';
import { colors, radius, spacing, typography } from '../../theme';

const PAD = 14;
/** 지도에 보일 최소 범위 (m). 막 시작했을 때 너무 확대되지 않게 */
const MAP_MIN_SPAN_M = 300;

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

/** 네이버 지도 위 경로. 지도는 경로 전체가 보이게 맞추고, 손으로 움직이지 않게 고정한다 */
function RouteMap({ points, height }) {
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
  const region = {
    latitude: (minLat + maxLat) / 2 - latSpan / 2,
    longitude: (minLng + maxLng) / 2 - lngSpan / 2,
    latitudeDelta: latSpan,
    longitudeDelta: lngSpan,
  };
  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  // 원 반지름은 m 단위라, 지도 범위에 맞춰 화면에서 비슷한 크기로 보이게 한다
  const dot = Math.max(6, latSpan * 111320 * 0.02);
  const start = coords[0];
  const end = coords[coords.length - 1];

  return (
    <View style={[styles.box, { height }]} accessibilityLabel="달린 경로 지도">
      <NaverMapView
        style={StyleSheet.absoluteFill}
        region={region}
        isScrollGesturesEnabled={false}
        isZoomGesturesEnabled={false}
        isTiltGesturesEnabled={false}
        isRotateGesturesEnabled={false}
        isShowZoomControls={false}
        isShowLocationButton={false}
        isShowCompass={false}
        isShowScaleBar={false}
      >
        <NaverMapPathOverlay
          coords={coords}
          width={6}
          color={colors.primary}
          outlineWidth={1}
          outlineColor={colors.onPrimary}
        />
        <NaverMapCircleOverlay {...start} radius={dot} color={colors.success} outlineWidth={2} outlineColor={colors.onPrimary} />
        <NaverMapCircleOverlay {...end} radius={dot * 1.2} color={colors.danger} outlineWidth={2} outlineColor={colors.onPrimary} />
      </NaverMapView>
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
});
