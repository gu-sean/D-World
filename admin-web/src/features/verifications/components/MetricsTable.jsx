import { Descriptions, Tag, Typography } from 'antd';
import { t } from '../../../i18n/index.js';

// VerificationMetrics (docs/07 §8): every key is always present, `null` when it does not apply.
// Only the keys that have a value are shown. `unit` is added after the number.
const ROWS = [
  { key: 'exerciseCode', label: t('운동') },
  { key: 'repCount', label: t('반복 횟수'), unit: t('회') },
  { key: 'validRepCount', label: t('인정 횟수'), unit: t('회') },
  { key: 'invalidRepCount', label: t('불인정 횟수'), unit: t('회') },
  { key: 'holdSeconds', label: t('유지 시간'), unit: t('초') },
  { key: 'accuracy', label: t('정확도'), percent: true },
  { key: 'durationSeconds', label: t('영상·측정 시간'), unit: t('초') },
  { key: 'personDetected', label: t('사람 인식'), bool: true },
  { key: 'distanceMeters', label: t('거리'), unit: 'm' },
  { key: 'activeSeconds', label: t('활동 시간'), unit: t('초') },
  { key: 'avgPaceSecondsPerKm', label: t('평균 페이스'), unit: t('초/km') },
  { key: 'steps', label: t('걸음 수'), unit: t('걸음') },
  { key: 'avgCadenceSpm', label: t('평균 케이던스'), unit: t('걸음/분') },
  { key: 'validPointRatio', label: t('유효 GPS 비율'), percent: true },
  { key: 'mockLocationDetected', label: t('모의 위치 감지'), bool: true },
];

// Flag codes the AI server and the backend add (parts/ai.md §6.3, §6.4, §7.3).
const FLAG_TEXT = {
  video_unreadable: t('영상을 열 수 없음'),
  video_too_long: t('영상 길이 초과'),
  no_person: t('사람을 찾지 못함'),
  low_visibility: t('몸이 잘 보이지 않음'),
  low_confidence: t('신뢰도 낮음'),
  bad_form: t('자세 부정확'),
  insufficient_reps: t('목표 횟수 미달'),
  hold_too_short: t('유지 시간 미달'),
  photo_unreadable: t('사진을 열 수 없음'),
  duplicate_media: t('중복 사진'),
  photo_too_small: t('사진이 너무 작음'),
  blank_photo: t('사진이 비어 있음'),
  photo_review: t('사진 확인 필요'),
  mock_location: t('모의 위치'),
  insufficient_gps: t('GPS 신호 약함'),
  vehicle_suspected: t('차량 이동 의심'),
  target_not_met: t('목표 미달'),
  gps_teleport: t('GPS 순간 이동'),
  pace_out_of_range: t('페이스 범위 밖'),
  steps_missing: t('걸음 수 없음'),
  cadence_out_of_range: t('케이던스 범위 밖'),
  stride_out_of_range: t('보폭 범위 밖'),
  time_mismatch: t('시각 불일치'),
  client_metrics_mismatch: t('앱 측정값과 차이'),
  checksum_mismatch: t('파일 체크섬 불일치'),
  possible_replay: t('재사용 의심'),
};

const formatValue = (row, value) => {
  if (row.bool) return value ? t('예') : t('아니요');
  if (row.percent) return `${Math.round(value * 100)}%`;
  return `${value}${row.unit ? ` ${row.unit}` : ''}`;
};

/**
 * Measured values of one verification result (docs/07 §8 `VerificationMetrics`).
 * Numbers are shown as the server sent them (docs/parts/admin-web.md §7 rule 3).
 * @param {{metrics: Record<string, any>|null|undefined}} props
 */
export default function MetricsTable({ metrics }) {
  if (!metrics) return <Typography.Text type="secondary">{t('측정값이 없어요.')}</Typography.Text>;

  const rows = ROWS.filter((row) => metrics[row.key] != null);
  const flags = metrics.flags ?? [];
  const issues = metrics.issues ?? [];

  return (
    <Descriptions size="small" bordered column={2}>
      {rows.map((row) => (
        <Descriptions.Item key={row.key} label={row.label}>
          {formatValue(row, metrics[row.key])}
        </Descriptions.Item>
      ))}
      {metrics.mediaSha256 && (
        <Descriptions.Item label={t('파일 SHA-256')} span={2}>
          <Typography.Text code copyable>
            {metrics.mediaSha256}
          </Typography.Text>
        </Descriptions.Item>
      )}
      <Descriptions.Item label={t('판정 사유 코드')} span={2}>
        {flags.length ? (
          flags.map((flag) => (
            <Tag key={flag} color="warning" title={flag}>
              {FLAG_TEXT[flag] ?? flag}
            </Tag>
          ))
        ) : (
          <Typography.Text type="secondary">{t('없음')}</Typography.Text>
        )}
      </Descriptions.Item>
      {issues.length > 0 && (
        <Descriptions.Item label={t('자세 문제 구간')} span={2}>
          <Typography.Text code className="pre-wrap">
            {JSON.stringify(issues)}
          </Typography.Text>
        </Descriptions.Item>
      )}
    </Descriptions>
  );
}
