import { Alert, Space, Spin, Typography } from 'antd';
import { useVerificationRoute } from '../queries.js';
import { t } from '../../../i18n/index.js';

// Static drawing of a running record's route (no map tiles, no external service).
// The server turns the raw GPS file into segments and distance markers; this only draws them.
const WIDTH = 720;
const HEIGHT = 400;
const PAD = 44;
const MIN_SPAN_M = 60; // keep a short GPS jitter from filling the whole frame
const RUN_COLOR = '#4C7DFF';
const VEHICLE_COLOR = '#EF9F27';
const START_COLOR = '#1D9E75';
const END_COLOR = '#D85A30';
const SCALE_STEPS = [20, 50, 100, 200, 500, 1000, 2000, 5000];

const formatKm = (meters) => `${Number((meters / 1000).toFixed(2))}km`;

/** lat/lng -> x/y that fit the frame with equal meters per pixel on both axes. */
function makeProjection(segments) {
  const all = segments.flatMap((s) => s.points);
  const lats = all.map((p) => p[0]);
  const lngs = all.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * metersPerLng, MIN_SPAN_M);
  const spanY = Math.max((maxLat - minLat) * metersPerLat, MIN_SPAN_M);
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2 - 24) / spanY); // px per meter
  const offsetX = PAD + (WIDTH - PAD * 2 - (maxLng - minLng) * metersPerLng * scale) / 2;
  const offsetY = PAD + 24 + (HEIGHT - PAD * 2 - 24 - (maxLat - minLat) * metersPerLat * scale) / 2;
  return {
    scale,
    toXY: ([lat, lng]) => [
      offsetX + (lng - minLng) * metersPerLng * scale,
      offsetY + (maxLat - lat) * metersPerLat * scale,
    ],
  };
}

function RouteSvg({ route }) {
  const { segments, markers, start, end } = route;
  const { scale, toXY } = makeProjection(segments);
  const toPoints = (points) =>
    points
      .map((p) =>
        toXY(p)
          .map((v) => v.toFixed(1))
          .join(','),
      )
      .join(' ');
  const [sx, sy] = toXY([start.lat, start.lng]);
  const [ex, ey] = toXY([end.lat, end.lng]);
  const barMeters = SCALE_STEPS.find((m) => m * scale >= 70) ?? SCALE_STEPS.at(-1);
  const barPx = barMeters * scale;
  const halo = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={t('러닝 경로')}
      style={{ background: '#F4F6FA', borderRadius: 8, display: 'block', maxWidth: WIDTH }}
    >
      <text x={PAD - 8} y={30} fontSize="16" fontWeight="600" fill="#1F2430">
        {t('러닝 경로')} · {t('총 {0}', formatKm(route.distanceMeters))}
      </text>
      {segments.map((segment, index) => (
        <polyline
          key={index}
          points={toPoints(segment.points)}
          fill="none"
          stroke={segment.kind === 'vehicle' ? VEHICLE_COLOR : RUN_COLOR}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={segment.kind === 'vehicle' ? '8 7' : undefined}
        />
      ))}
      {markers.map((marker) => {
        const [x, y] = toXY([marker.lat, marker.lng]);
        return (
          <g key={marker.meters}>
            <circle cx={x} cy={y} r="6" fill="#fff" stroke="#2D55C9" strokeWidth="2" />
            <text x={x} y={y - 12} fontSize="12" textAnchor="middle" fill="#1F2430" style={halo}>
              {formatKm(marker.meters)}
            </text>
          </g>
        );
      })}
      <circle cx={sx} cy={sy} r="8" fill={START_COLOR} stroke="#fff" strokeWidth="2" />
      <text x={sx} y={sy + 24} fontSize="13" textAnchor="middle" fill="#1F2430" style={halo}>
        {t('시작')}
      </text>
      <circle cx={ex} cy={ey} r="10" fill={END_COLOR} stroke="#fff" strokeWidth="2.5" />
      <text
        x={ex}
        y={ey - 16}
        fontSize="13"
        fontWeight="600"
        textAnchor="middle"
        fill="#1F2430"
        style={halo}
      >
        {t('마지막 위치')}
      </text>
      <g transform={`translate(${PAD - 8}, ${HEIGHT - 22})`}>
        <line x1="0" y1="0" x2={barPx} y2="0" stroke="#6B7280" strokeWidth="2" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke="#6B7280" strokeWidth="2" />
        <line x1={barPx} y1="-5" x2={barPx} y2="5" stroke="#6B7280" strokeWidth="2" />
        <text x={barPx + 8} y="4" fontSize="12" fill="#4B5563">
          {barMeters >= 1000 ? `${barMeters / 1000} km` : `${barMeters} m`}
        </text>
      </g>
    </svg>
  );
}

/**
 * Route picture of a running record. Hidden problems stay quiet: a record without a raw GPS file
 * shows a short note instead of an error box.
 * @param {{recordId: string}} props
 */
export default function RunRouteImage({ recordId }) {
  const query = useVerificationRoute(recordId);

  if (query.isPending) return <Spin size="small" />;
  if (query.isError) {
    if (query.error?.status === 404) {
      return (
        <Typography.Text type="secondary">
          {t('GPS 원본 파일이 없어 경로를 그릴 수 없어요.')}
        </Typography.Text>
      );
    }
    return <Alert type="warning" showIcon title={t('경로를 불러오지 못했어요.')} />;
  }
  const route = query.data;
  if (!route.start || route.segments.length === 0) {
    return (
      <Typography.Text type="secondary">{t('경로를 그릴 만큼 GPS 점이 없어요.')}</Typography.Text>
    );
  }

  const hasVehicle = route.segments.some((s) => s.kind === 'vehicle');
  return (
    <Space orientation="vertical" size="small" style={{ width: '100%' }}>
      <RouteSvg route={route} />
      <Space size="large" wrap>
        <Typography.Text type="secondary">
          {t('이동거리 표시는 {0}m마다', route.markerEveryMeters)}
        </Typography.Text>
        {hasVehicle && (
          <Typography.Text style={{ color: '#B7791F' }}>
            {t('점선: 탈것 의심 구간 {0}m는 거리에서 뺌', route.vehicleMeters)}
          </Typography.Text>
        )}
      </Space>
    </Space>
  );
}
