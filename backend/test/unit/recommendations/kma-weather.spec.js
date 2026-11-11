import {
  fcstBase,
  fetchKmaWeather,
  ncstBase,
  parseNcst,
  parseSky,
  precipitationOf,
  skyOf,
  toGrid,
} from '../../../src/recommendations/kma-weather.js';

const ok = (items) => ({
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
    body: { items: { item: items } },
  },
});
const ncst = (t1h, pty = 0) =>
  ok([
    { category: 'T1H', obsrValue: String(t1h) },
    { category: 'PTY', obsrValue: String(pty) },
    { category: 'REH', obsrValue: '50' },
  ]);
const fcst = (sky) =>
  ok([
    { category: 'SKY', fcstDate: '20261109', fcstTime: '1200', fcstValue: '4' },
    { category: 'SKY', fcstDate: '20261109', fcstTime: '1100', fcstValue: sky },
    { category: 'T1H', fcstDate: '20261109', fcstTime: '1100', fcstValue: '9' },
  ]);

/** 주소의 경로로 실황·예보를 구분해 응답하는 가짜 fetch */
function fakeFetch({ ncstBody, fcstBody, status = 200 }) {
  const calls = [];
  const impl = async (url) => {
    calls.push(new URL(url));
    const isNcst = String(url).includes('getUltraSrtNcst');
    return {
      ok: status === 200,
      status,
      json: async () => (isNcst ? ncstBody : fcstBody),
    };
  };
  return { impl, calls };
}

// 2026-11-09 10:52 KST
const AT = new Date('2026-11-09T01:52:00Z');
const run = (fetchImpl) =>
  fetchKmaWeather({
    authKey: 'KEY',
    latitude: 37.5665,
    longitude: 126.978,
    at: AT,
    fetchImpl,
  });

describe('toGrid', () => {
  it('서울·부산은 기상청 공개 격자 번호', () => {
    expect(toGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
    expect(toGrid(35.1796, 129.0756)).toEqual({ nx: 98, ny: 76 });
  });

  it('격자 범위 밖(일본 등)은 null', () => {
    expect(toGrid(35.68, 139.69)).toBeNull();
    expect(toGrid(Number.NaN, 127)).toBeNull();
  });
});

describe('발표 시각', () => {
  it('실황: 15분 전을 10분 단위로 내림, 자정 직후는 전날', () => {
    expect(ncstBase(AT)).toEqual({ date: '20261109', time: '1030' });
    expect(ncstBase(new Date('2026-11-08T15:05:00Z'))).toEqual({
      date: '20261108',
      time: '2350',
    });
  });

  it('초단기예보: 매시 30분 발표, 45분 이후 제공', () => {
    expect(fcstBase(AT)).toEqual({ date: '20261109', time: '1030' });
    // 10:40이면 아직 10:30 발표분이 없어 09:30
    expect(fcstBase(new Date('2026-11-09T01:40:00Z'))).toEqual({
      date: '20261109',
      time: '0930',
    });
    expect(fcstBase(new Date('2026-11-08T15:05:00Z'))).toEqual({
      date: '20261108',
      time: '2330',
    });
  });
});

describe('코드 변환', () => {
  it('강수형태', () => {
    expect(precipitationOf(0)).toBeNull();
    expect([1, 2, 5, 6].map(precipitationOf)).toEqual([
      'rain',
      'rain',
      'rain',
      'rain',
    ]);
    expect([3, 7].map(precipitationOf)).toEqual(['snow', 'snow']);
  });

  it('하늘상태', () => {
    expect(skyOf('1')).toBe('clear');
    expect(skyOf('3')).toBe('clouds');
    expect(skyOf('4')).toBe('clouds');
    expect(skyOf('2')).toBeNull();
  });

  it('실황: 반올림하고 결측(-999) 기온은 null', () => {
    expect(parseNcst(ncst('12.6').response.body.items.item)).toEqual({
      temperatureC: 13,
      precipitation: null,
    });
    expect(parseNcst(ncst('-999').response.body.items.item)).toBeNull();
    expect(parseNcst([])).toBeNull();
  });

  it('예보: 가장 가까운 시각의 하늘상태', () => {
    expect(parseSky(fcst('1').response.body.items.item)).toBe('clear');
  });
});

describe('fetchKmaWeather', () => {
  it('강수 없으면 하늘상태로, 두 API를 같은 격자·인증키로 호출', async () => {
    const { impl, calls } = fakeFetch({
      ncstBody: ncst('8.4'),
      fcstBody: fcst('1'),
    });
    expect(await run(impl)).toEqual({ weather: 'clear', temperatureC: 8 });
    expect(calls).toHaveLength(2);
    const ncstCall = calls.find((u) => u.pathname.endsWith('getUltraSrtNcst'));
    expect(Object.fromEntries(ncstCall.searchParams)).toMatchObject({
      dataType: 'JSON',
      base_date: '20261109',
      base_time: '1030',
      nx: '60',
      ny: '127',
      authKey: 'KEY',
    });
    const fcstCall = calls.find((u) => u.pathname.endsWith('getUltraSrtFcst'));
    expect(fcstCall.searchParams.get('base_time')).toBe('1030');
  });

  it('구름 많음·흐림은 clouds', async () => {
    const { impl } = fakeFetch({ ncstBody: ncst(20), fcstBody: fcst('3') });
    expect(await run(impl)).toEqual({ weather: 'clouds', temperatureC: 20 });
  });

  it('강수가 있으면 하늘상태보다 우선', async () => {
    const rain = fakeFetch({ ncstBody: ncst(10, 1), fcstBody: fcst('1') });
    expect((await run(rain.impl)).weather).toBe('rain');
    const snow = fakeFetch({ ncstBody: ncst(-1, 3), fcstBody: fcst('4') });
    expect(await run(snow.impl)).toEqual({ weather: 'snow', temperatureC: -1 });
  });

  it('한쪽이라도 실패·비정상·형식 오류면 null', async () => {
    const bad = {
      response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } },
    };
    for (const options of [
      { ncstBody: bad, fcstBody: fcst('1') },
      { ncstBody: ncst(10), fcstBody: bad },
      { ncstBody: { result: { status: 403 } }, fcstBody: fcst('1') },
      { ncstBody: ncst(10), fcstBody: ok([]) },
      { ncstBody: ncst(-999), fcstBody: fcst('1') },
      { ncstBody: ncst(10), fcstBody: fcst('2') },
      { ncstBody: ncst(10), fcstBody: fcst('1'), status: 500 },
    ]) {
      expect(await run(fakeFetch(options).impl)).toBeNull();
    }
  });

  it('격자 밖 좌표는 호출 없이 null', async () => {
    const { impl, calls } = fakeFetch({
      ncstBody: ncst(10),
      fcstBody: fcst('1'),
    });
    const result = await fetchKmaWeather({
      authKey: 'KEY',
      latitude: 35.68,
      longitude: 139.69,
      at: AT,
      fetchImpl: impl,
    });
    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
