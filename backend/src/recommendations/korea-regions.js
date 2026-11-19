/**
 * 시도 대표 좌표(도청·시청 소재지 근처)와 위경도 → 가장 가까운 시도
 * 날씨 알림이 회원의 지역을 시도 단위로 대략 정하는 데만 쓴다(미세먼지는 시도 단위로 수집).
 * 이름은 에어코리아 API의 sidoName과 같다. 경계 지역은 이웃 시도로 잡힐 수 있다.
 */
export const SIDO_CENTERS = [
  ['서울', 37.5665, 126.978],
  ['부산', 35.1796, 129.0756],
  ['대구', 35.8714, 128.6014],
  ['인천', 37.4563, 126.7052],
  ['광주', 35.1595, 126.8526],
  ['대전', 36.3504, 127.3845],
  ['울산', 35.5384, 129.3114],
  ['세종', 36.48, 127.289],
  ['경기', 37.275, 127.0094],
  ['강원', 37.8813, 127.7298],
  ['충북', 36.6357, 127.4917],
  ['충남', 36.6588, 126.6728],
  ['전북', 35.8242, 127.148],
  ['전남', 34.8161, 126.4629],
  ['경북', 36.576, 128.5056],
  ['경남', 35.2383, 128.6925],
  ['제주', 33.4996, 126.5312],
];

/** 위치를 보낸 적 없는 회원에게 쓰는 기본 지역: 서울(동네예보 격자 60, 127) */
export const DEFAULT_REGION = { nx: 60, ny: 127, sido: '서울' };

const RAD = Math.PI / 180;

/** 두 지점 사이 거리(km, 하버사인) */
function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** 위경도에서 가장 가까운 시도 이름, 숫자가 아니면 null */
export function sidoOf(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const [name, lat, lon] of SIDO_CENTERS) {
    const distance = distanceKm(latitude, longitude, lat, lon);
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}
