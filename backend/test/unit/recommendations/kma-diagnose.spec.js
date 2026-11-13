import { jest } from '@jest/globals';
import { diagnoseKma } from '../../../src/recommendations/kma-diagnose.js';

const SEOUL = { latitude: 37.5665, longitude: 126.978 };
const AT = new Date('2026-11-13T03:00:00Z'); // KST 12:00

const ok = (items) => ({
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
    body: { items: { item: items } },
  },
});
const ncstOk = ok([
  { category: 'T1H', obsrValue: '12' },
  { category: 'PTY', obsrValue: '0' },
]);
const fcstOk = ok([
  { category: 'SKY', fcstDate: '20261113', fcstTime: '1300', fcstValue: '3' },
]);
const errorBody = (code, msg) => ({
  response: { header: { resultCode: code, resultMsg: msg } },
});

/** API 이름(경로)별로 응답을 정해 주는 가짜 fetch */
const fakeFetch = (byApi) => async (url) => {
  const key = String(url).includes('getUltraSrtNcst') ? 'ncst' : 'fcst';
  const answer = byApi[key];
  if (answer instanceof Error) throw answer;
  const { status = 200, body } = answer;
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
  });
};

const run = (byApi) =>
  diagnoseKma({
    authKey: 'secret-key',
    ...SEOUL,
    at: AT,
    fetchImpl: fakeFetch(byApi),
  });

describe('diagnoseKma', () => {
  it('정상: 날씨를 돌려주고 problem은 null, 두 API 호출이 기록됨', async () => {
    const result = await run({
      ncst: { body: ncstOk },
      fcst: { body: fcstOk },
    });
    expect(result.problem).toBeNull();
    expect(result.weather).toEqual({ weather: 'clouds', temperatureC: 12 });
    expect(result.grid).toEqual({ nx: 60, ny: 127 });
    expect(result.calls.map((call) => call.api).sort()).toEqual([
      '초단기실황',
      '초단기예보',
    ]);
    expect(
      result.calls.every(
        (call) => call.httpStatus === 200 && call.resultCode === '00',
      ),
    ).toBe(true);
  });

  it('호출 기록에 인증키·주소·응답 원문이 들어가지 않음', async () => {
    const result = await run({
      ncst: { body: ncstOk },
      fcst: { body: fcstOk },
    });
    expect(JSON.stringify(result)).not.toContain('secret-key');
    expect(Object.keys(result.calls[0]).sort()).toEqual(
      ['api', 'httpStatus', 'ms', 'resultCode', 'resultMsg'].sort(),
    );
  });

  it('한반도 밖 좌표는 호출 없이 out_of_grid', async () => {
    const fetchImpl = jest.fn();
    const result = await diagnoseKma({
      authKey: 'k',
      latitude: 0,
      longitude: 0,
      fetchImpl,
    });
    expect(result.problem.kind).toBe('out_of_grid');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('인증키가 등록되지 않았으면(결과 30) 키 문제로 안내', async () => {
    const body = errorBody('30', 'SERVICE KEY IS NOT REGISTERED ERROR.');
    const result = await run({ ncst: { body }, fcst: { body } });
    expect(result.weather).toBeNull();
    expect(result.problem.kind).toBe('api_error');
    expect(result.problem.message).toContain('등록되지 않은 인증키');
    expect(result.problem.message).toContain('[30]');
  });

  it('신청하지 않은 API(결과 12)·한도 초과(22)·IP 제한(32)을 각각 안내', async () => {
    for (const [code, expected] of [
      ['12', '신청하지 않은 API'],
      ['22', '호출 한도'],
      ['32', 'IP'],
    ]) {
      const body = errorBody(code, 'x');
      const result = await run({ ncst: { body: ncstOk }, fcst: { body } });
      expect(result.problem.message).toContain(expected);
    }
  });

  it('HTTP 401은 인증 실패 힌트, 500은 상태만', async () => {
    const unauthorized = await run({
      ncst: { status: 401, body: 'denied' },
      fcst: { body: fcstOk },
    });
    expect(unauthorized.problem.kind).toBe('http_error');
    expect(unauthorized.problem.message).toContain('401');
    expect(unauthorized.problem.message).toContain('인증키');

    const server = await run({
      ncst: { status: 500, body: 'oops' },
      fcst: { body: fcstOk },
    });
    expect(server.problem.message).toContain('500');
    expect(server.problem.message).not.toContain('인증키');
  });

  it('JSON이 아닌 응답이어도 HTTP 상태로 판정', async () => {
    const result = await run({
      ncst: { status: 200, body: '<xml>error</xml>' },
      fcst: { body: fcstOk },
    });
    expect(result.weather).toBeNull();
    expect(result.problem.kind).toBe('no_data');
  });

  it('시간 초과·연결 실패는 network로 구분', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const slow = await run({ ncst: timeout, fcst: { body: fcstOk } });
    expect(slow.problem.kind).toBe('network');
    expect(slow.problem.message).toContain('시간 안에');

    const down = await run({
      ncst: new TypeError('fetch failed'),
      fcst: { body: fcstOk },
    });
    expect(down.problem.kind).toBe('network');
    expect(down.problem.message).toContain('TypeError');
  });

  it('응답은 정상인데 기온이 결측이면 no_data', async () => {
    const missing = ok([{ category: 'T1H', obsrValue: '-999' }]);
    const result = await run({
      ncst: { body: missing },
      fcst: { body: fcstOk },
    });
    expect(result.problem.kind).toBe('no_data');
  });
});
