// 에어코리아(한국환경공단) 대기오염정보: 시도별 실시간 측정정보 (공공데이터포털 apis.data.go.kr)
const BASE_URL =
  'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty';

/** 미세먼지 '나쁨' 기준(환경부): PM10 81㎍/㎥ 이상, PM2.5 36㎍/㎥ 이상 */
export const PM10_BAD = 81;
export const PM25_BAD = 36;

/** '15' 같은 숫자 문자열만 값으로 본다(점검·통신장애는 '-'나 빈 값) */
const toValue = (raw) => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || !/^\d{1,4}$/.test(raw.trim())) return null;
  return Number(raw.trim());
};

const average = (values) => {
  const valid = values.filter((value) => value !== null);
  if (valid.length === 0) return null;
  return Math.round(
    valid.reduce((sum, value) => sum + value, 0) / valid.length,
  );
};

/**
 * 측정소 item 배열 → 시도 평균 { pm10, pm25 }, 둘 다 읽을 수 없으면 null
 * 측정소 하나가 고장이어도 나머지 평균으로 시도 값을 만든다.
 */
export function parseAirItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const pm10 = average(items.map((item) => toValue(item?.pm10Value)));
  const pm25 = average(items.map((item) => toValue(item?.pm25Value)));
  if (pm10 === null && pm25 === null) return null;
  return { pm10, pm25 };
}

/** 미세먼지가 '나쁨' 이상인지(PM10 또는 PM2.5), 값이 없으면 false */
export function isBadAir({ pm10, pm25 } = {}) {
  return (
    (typeof pm10 === 'number' && pm10 >= PM10_BAD) ||
    (typeof pm25 === 'number' && pm25 >= PM25_BAD)
  );
}

/**
 * 시도 하나의 미세먼지 조회 → { pm10, pm25 } | null(실패·값 없음)
 * 서비스 키가 요청 주소에 들어 있으므로 주소·응답 원문은 로그에 남기지 않는다.
 */
export async function fetchAirKoreaBySido({
  serviceKey,
  sido,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('numOfRows', '300');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('sidoName', sido);
  url.searchParams.set('ver', '1.0');
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  const body = await response.json();
  if (body?.response?.header?.resultCode !== '00') return null;
  return parseAirItems(body?.response?.body?.items);
}
