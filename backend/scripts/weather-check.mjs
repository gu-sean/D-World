// 날씨 조회가 되는지 실제 호출로 점검한다 (README "날씨 설정" 참고)
//
// 사용: npm run weather:check [-- --lat 37.5665 --lon 126.978] [--driver kma|openweather|mock]
//   기본 좌표는 서울시청, 기본 드라이버는 .env 의 WEATHER_DRIVER.
//   kma 는 API(초단기실황·초단기예보)별 HTTP 상태와 결과 코드를 보여 주고, 실패하면 원인을 알려 준다.
// 종료 코드: 0 = 날씨를 받아 왔음(mock 포함), 1 = 문제 있음
//
// 주의: 네트워크 요청 직후 process.exit()를 부르면 Windows의 Node에서 비정상 종료(코드 127)가 되므로
//       process.exitCode 를 설정하고 자연스럽게 끝낸다.
// (weather.client.js 는 Nest 데코레이터를 써서 빌드 없이는 못 읽으므로, openweather 점검에서만 dist 를 불러온다)
import { diagnoseKma } from '../src/recommendations/kma-diagnose.js';

/** 점검 실패: 메시지를 보여 주고 종료 코드 1로 끝낸다 */
class CheckFailed extends Error {}
const fail = (message) => {
  throw new CheckFailed(message);
};

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main() {
  const latitude = Number(valueOf('--lat') ?? 37.5665);
  const longitude = Number(valueOf('--lon') ?? 126.978);
  const driver = valueOf('--driver') ?? process.env.WEATHER_DRIVER ?? 'mock';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    fail('--lat, --lon 은 숫자여야 해요 (예: --lat 35.1796 --lon 129.0756)');
  }

  console.log(`▶ 드라이버: ${driver}   좌표: ${latitude}, ${longitude}`);

  if (driver === 'mock') {
    console.log(
      '✔ mock 드라이버라 항상 "맑음 20°C"를 돌려줘요 (실제 날씨가 아니에요).\n' +
        '  실제 날씨를 쓰려면 .env 에 WEATHER_DRIVER=kma 와 KMA_AUTH_KEY 를 넣으세요. (backend/README.md "날씨 설정")',
    );
    return;
  }

  if (driver === 'kma') {
    const authKey = process.env.KMA_AUTH_KEY?.trim();
    if (!authKey) {
      fail(
        'KMA_AUTH_KEY 가 비어 있어요. 기상청 API허브(apihub.kma.go.kr)에서 인증키를 받아 .env 에 넣어 주세요.',
      );
    }
    const result = await diagnoseKma({ authKey, latitude, longitude });
    if (result.grid) {
      console.log(
        `▶ 격자(nx, ny): ${result.grid.nx}, ${result.grid.ny}   발표 기준: 실황 ${result.bases.ncst.date} ${result.bases.ncst.time} / 예보 ${result.bases.fcst.date} ${result.bases.fcst.time}`,
      );
    }
    for (const call of result.calls) {
      const detail = call.error
        ? `오류 ${call.error}`
        : `HTTP ${call.httpStatus}${call.resultCode ? `, 결과 ${call.resultCode}${call.resultMsg ? ` (${call.resultMsg})` : ''}` : ''}`;
      console.log(`  · ${call.api}: ${detail} (${call.ms}ms)`);
    }
    if (!result.weather) fail(result.problem.message);
    console.log(
      `✔ 기상청 날씨: ${result.weather.weather}, ${result.weather.temperatureC}°C`,
    );
    return;
  }

  if (driver === 'openweather') {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) fail('OPENWEATHER_API_KEY 가 비어 있어요.');
    let WeatherClient;
    try {
      ({ WeatherClient } =
        await import('../dist/recommendations/weather.client.js'));
    } catch {
      fail(
        'OpenWeather 점검은 빌드 결과물이 필요해요. 먼저 npm run build 를 실행하세요.',
      );
    }
    const config = {
      get: (name) =>
        ({ WEATHER_DRIVER: 'openweather', OPENWEATHER_API_KEY: key })[name],
    };
    const weather = await new WeatherClient(config, {}).current({
      latitude,
      longitude,
    });
    if (!weather) {
      fail(
        'OpenWeather에서 날씨를 받지 못했어요. 키가 맞는지, 호출 한도를 넘지 않았는지 확인하세요.',
      );
    }
    console.log(
      `✔ OpenWeather 날씨: ${weather.weather}, ${weather.temperatureC}°C`,
    );
    return;
  }

  fail(`지원하지 않는 드라이버: ${driver} (mock, kma, openweather 중 하나)`);
}

try {
  await main();
} catch (error) {
  if (!(error instanceof CheckFailed)) throw error;
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
}
