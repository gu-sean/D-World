import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

// 기상청 API허브 동네예보 (https://apihub.kma.go.kr), 초단기실황·초단기예보 사용
const BASE_URL =
  'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0';
const NCST_PATH = 'getUltraSrtNcst'; // 초단기실황: 기온(T1H)·강수형태(PTY)
const FCST_PATH = 'getUltraSrtFcst'; // 초단기예보: 하늘상태(SKY), 실황에는 없음
const MISSING = -999; // 기상청 결측값

/**
 * 위경도 → 동네예보 격자(nx, ny), 기상청 공개 변환식(람베르트 정각원추, 5km 격자)
 * 격자 범위(nx 1~149, ny 1~253) 밖이면 null
 */
export function toGrid(latitude, longitude) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + latitude * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = longitude * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  if (nx < 1 || nx > 149 || ny < 1 || ny > 253) return null;
  return { nx, ny };
}

const stamp = (kst) => ({
  date: kst.format('YYYYMMDD'),
  time: kst.format('HHmm'),
});
const toKst = (at) => dayjs.utc(at).add(9, 'hour');

/**
 * 초단기실황 발표 시각: 10분 간격 발표, 생성 지연을 고려해 15분 전 시각을 10분 단위로 내림
 */
export function ncstBase(at = new Date()) {
  const t = toKst(at).subtract(15, 'minute');
  return stamp(t.minute(Math.floor(t.minute() / 10) * 10));
}

/** 초단기예보 발표 시각: 매시 30분 발표, 45분 이후 제공 */
export function fcstBase(at = new Date()) {
  const t = toKst(at).subtract(45, 'minute').startOf('hour').add(30, 'minute');
  return stamp(t);
}

/** 강수형태(PTY) → 앱 날씨. 0=없음(null), 1·2·5·6=비, 3·7=눈 */
export function precipitationOf(pty) {
  switch (Number(pty)) {
    case 1:
    case 2:
    case 5:
    case 6:
      return 'rain';
    case 3:
    case 7:
      return 'snow';
    default:
      return null;
  }
}

/** 하늘상태(SKY) → 앱 날씨. 1=맑음, 3=구름많음, 4=흐림 */
export function skyOf(sky) {
  switch (Number(sky)) {
    case 1:
      return 'clear';
    case 3:
    case 4:
      return 'clouds';
    default:
      return null;
  }
}

/** 응답 본문 → item 배열, 정상(00)이 아니거나 형식이 다르면 null */
export function itemsOf(body) {
  const response = body?.response;
  if (response?.header?.resultCode !== '00') return null;
  const items = response?.body?.items?.item;
  return Array.isArray(items) ? items : null;
}

/** 실황 item → { temperatureC, precipitation }, 기온이 결측이면 null */
export function parseNcst(items) {
  const value = (category) => {
    const found = items.find((item) => item.category === category);
    const number = Number(found?.obsrValue);
    return found && Number.isFinite(number) && number !== MISSING
      ? number
      : null;
  };
  const temperature = value('T1H');
  if (temperature === null) return null;
  return {
    temperatureC: Math.round(temperature),
    precipitation: precipitationOf(value('PTY')),
  };
}

/** 예보 item → 가장 가까운 예보 시각의 하늘상태 */
export function parseSky(items) {
  const skies = items
    .filter((item) => item.category === 'SKY')
    .sort((a, b) =>
      `${a.fcstDate}${a.fcstTime}`.localeCompare(`${b.fcstDate}${b.fcstTime}`),
    );
  return skyOf(skies[0]?.fcstValue);
}

/**
 * 격자 하나의 날씨 조회: 실황(기온·강수)과 초단기예보(하늘상태)를 함께 호출
 * 강수가 있으면 하늘상태와 상관없이 rain·snow, 둘 중 하나라도 못 읽으면 null(날씨 모름)
 * 인증키가 요청 주소에 들어 있으므로 주소·응답 원문은 로그에 남기지 않는다.
 */
export async function fetchKmaWeatherByGrid({
  authKey,
  grid,
  at = new Date(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
}) {
  const call = async (path, base) => {
    const url = new URL(`${BASE_URL}/${path}`);
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('dataType', 'JSON');
    url.searchParams.set('base_date', base.date);
    url.searchParams.set('base_time', base.time);
    url.searchParams.set('nx', String(grid.nx));
    url.searchParams.set('ny', String(grid.ny));
    url.searchParams.set('authKey', authKey);
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return itemsOf(await response.json());
  };

  const [ncstItems, fcstItems] = await Promise.all([
    call(NCST_PATH, ncstBase(at)),
    call(FCST_PATH, fcstBase(at)),
  ]);
  if (!ncstItems || !fcstItems) return null;
  const now = parseNcst(ncstItems);
  if (!now) return null;
  const weather = now.precipitation ?? parseSky(fcstItems);
  if (!weather) return null;
  return { weather, temperatureC: now.temperatureC };
}

/** 위경도로 조회, 격자 밖이면 호출 없이 null */
export async function fetchKmaWeather({ latitude, longitude, ...options }) {
  const grid = toGrid(latitude, longitude);
  if (!grid) return null;
  return fetchKmaWeatherByGrid({ ...options, grid });
}
