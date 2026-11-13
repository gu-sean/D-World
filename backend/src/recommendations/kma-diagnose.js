/**
 * 기상청 날씨 호출 진단 (npm run weather:check, scripts/weather-check.mjs)
 *
 * 서버의 fetchKmaWeatherByGrid는 실패하면 조용히 null을 돌려줘서 키가 틀려도 원인이 안 보인다.
 * 여기서는 같은 함수를 그대로 부르되 fetch를 감싸 API별 HTTP 상태·결과 코드(resultCode)를 모아 원인을 가른다.
 * 인증키는 요청 주소에 들어 있어서 주소·응답 원문은 저장하지 않고 상태·코드·결과 메시지만 남긴다.
 */
import {
  fcstBase,
  fetchKmaWeatherByGrid,
  ncstBase,
  toGrid,
} from './kma-weather.js';

/** 기상청 API허브(공공데이터 공통) 결과 코드 중 자주 만나는 것 */
const RESULT_CODE_HINTS = {
  '03': '조회된 데이터가 없어요(발표 직후이거나 해당 시각·격자 자료 없음)',
  10: '요청 변수가 잘못됐어요',
  12: '이 키로 신청하지 않은 API예요. 초단기실황·초단기예보를 모두 신청했는지 확인하세요',
  20: '이 키는 이 API에 접근할 수 없어요(활용 신청 승인 필요)',
  21: '키가 일시적으로 사용 중지됐어요',
  22: '일일 호출 한도를 넘었어요',
  30: '등록되지 않은 인증키예요. KMA_AUTH_KEY가 맞는지 확인하세요',
  31: '인증키 사용 기간이 만료됐어요',
  32: '허용되지 않은 IP예요. API허브에서 서버 IP 등록이 필요할 수 있어요',
  33: '서명되지 않은 호출이에요',
};

const apiNameOf = (url) =>
  String(url).includes('getUltraSrtNcst') ? '초단기실황' : '초단기예보';

/**
 * @param {{authKey: string, latitude: number, longitude: number, at?: Date,
 *          fetchImpl?: Function, timeoutMs?: number}} options
 * @returns {Promise<{grid: object|null, bases: object|null, calls: object[],
 *   weather: object|null, problem: {kind: string, message: string}|null}>}
 *   problem.kind: out_of_grid · network · http_error · api_error · no_data (정상이면 problem은 null)
 */
export async function diagnoseKma({
  authKey,
  latitude,
  longitude,
  at = new Date(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
}) {
  const grid = toGrid(latitude, longitude);
  if (!grid) {
    return {
      grid: null,
      bases: null,
      calls: [],
      weather: null,
      problem: {
        kind: 'out_of_grid',
        message:
          '이 좌표는 기상청 동네예보 격자(한반도 주변) 밖이에요. 위도·경도를 확인하세요.',
      },
    };
  }
  const bases = { ncst: ncstBase(at), fcst: fcstBase(at) };
  const calls = [];

  const recording = async (url, init) => {
    const api = apiNameOf(url);
    const started = Date.now();
    try {
      const response = await fetchImpl(url, init);
      let header = {};
      try {
        header = (await response.clone().json())?.response?.header ?? {};
      } catch {
        // JSON이 아닌 응답(오류 페이지 등): HTTP 상태만 기록
      }
      calls.push({
        api,
        httpStatus: response.status,
        resultCode: header.resultCode,
        resultMsg: header.resultMsg,
        ms: Date.now() - started,
      });
      return response;
    } catch (error) {
      calls.push({
        api,
        error: error?.name ?? 'error',
        ms: Date.now() - started,
      });
      throw error;
    }
  };

  let weather = null;
  try {
    weather = await fetchKmaWeatherByGrid({
      authKey,
      grid,
      at,
      fetchImpl: recording,
      timeoutMs,
    });
  } catch {
    // 원인은 calls에 기록돼 있다
  }
  return {
    grid,
    bases,
    calls,
    weather,
    problem: weather ? null : explain(calls),
  };
}

/** 모은 호출 기록으로 실패 원인을 가린다 */
function explain(calls) {
  const failedCall = calls.find((call) => call.error);
  if (failedCall) {
    return {
      kind: 'network',
      message: `${failedCall.api} 호출이 ${
        failedCall.error === 'TimeoutError'
          ? '시간 안에 끝나지 않았어요'
          : `실패했어요 (${failedCall.error})`
      }. 네트워크·방화벽·프록시를 확인하세요.`,
    };
  }
  const httpError = calls.find((call) => call.httpStatus >= 400);
  if (httpError) {
    const keyHint =
      httpError.httpStatus === 401 || httpError.httpStatus === 403
        ? ' 인증키가 틀렸거나 권한이 없을 수 있어요.'
        : '';
    return {
      kind: 'http_error',
      message: `${httpError.api} 응답이 HTTP ${httpError.httpStatus}예요.${keyHint}`,
    };
  }
  const apiError = calls.find(
    (call) => call.resultCode && call.resultCode !== '00',
  );
  if (apiError) {
    const hint =
      RESULT_CODE_HINTS[Number(apiError.resultCode)] ??
      RESULT_CODE_HINTS[apiError.resultCode] ??
      '기상청이 오류를 돌려줬어요';
    return {
      kind: 'api_error',
      message: `${apiError.api}: [${apiError.resultCode}] ${hint}${apiError.resultMsg ? ` (${apiError.resultMsg})` : ''}`,
    };
  }
  return {
    kind: 'no_data',
    message:
      '응답은 정상인데 기온 또는 하늘상태를 읽지 못했어요(관측 결측이거나 응답 형식이 달라요). 잠시 뒤 다시 해 보세요.',
  };
}
