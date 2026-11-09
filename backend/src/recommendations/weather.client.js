import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchKmaWeatherByGrid, toGrid } from './kma-weather.js';
import { WeatherStoreService } from './weather-store.service.js';

export const WEATHER_TIMEOUT_MS = 5000;
// 기상청 API허브는 첫 연결이 느려(실측 3~5초) 따로 길게 둠
export const KMA_TIMEOUT_MS = 8000;

/** OpenWeather 상태(main) → 앱 날씨 코드 */
export function mapWeather(main) {
  switch (String(main).toLowerCase()) {
    case 'clear':
      return 'clear';
    case 'clouds':
      return 'clouds';
    case 'rain':
    case 'drizzle':
    case 'thunderstorm':
      return 'rain';
    case 'snow':
      return 'snow';
    default:
      return 'other';
  }
}

/**
 * 실외 운동에 알맞은 날씨인지: 맑거나 흐리고 5~30도
 * 비·눈·그 밖의 날씨나 알 수 없으면 아니다
 */
export function isOutdoorSuitable({ weather, temperatureC }) {
  return (
    (weather === 'clear' || weather === 'clouds') &&
    typeof temperatureC === 'number' &&
    temperatureC >= 5 &&
    temperatureC <= 30
  );
}

/** 시각(KST) → morning(5~11시)·afternoon(12~17시)·evening(18~21시)·night */
export function timeSlotOf(at = new Date()) {
  const hour = (at.getUTCHours() + 9) % 24;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/**
 * 날씨 조회 (WEATHER_DRIVER=mock | openweather | kma)
 * 좌표는 이 호출에만 쓰고 저장하거나 로그에 남기지 않는다.
 * 조회에 실패하면 날씨를 모르는 것으로 보고 null을 돌려준다(추천은 날씨 없이 계속).
 */
@Injectable()
@Dependencies(ConfigService, WeatherStoreService)
export class WeatherClient {
  logger = new Logger(WeatherClient.name);

  constructor(config, store) {
    this.config = config;
    this.store = store;
    // 테스트에서 가짜 fetch를 넣을 수 있게 호출 시점에 전역 fetch를 찾음
    this.fetchImpl = (...args) => globalThis.fetch(...args);
  }

  /** @returns {Promise<{weather: string, temperatureC: number}|null>} */
  async current({ latitude, longitude }) {
    const driver = this.config.get('WEATHER_DRIVER');
    if (driver === 'kma') return this.currentFromKma({ latitude, longitude });
    if (driver !== 'openweather') {
      return { weather: 'clear', temperatureC: 20 };
    }
    const key = this.config.get('OPENWEATHER_API_KEY');
    if (!key || latitude === undefined || longitude === undefined) return null;
    try {
      const url = new URL('https://api.openweathermap.org/data/2.5/weather');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('units', 'metric');
      url.searchParams.set('appid', key);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const body = await response.json();
      return {
        weather: mapWeather(body.weather?.[0]?.main),
        temperatureC: Math.round(body.main?.temp),
      };
    } catch (error) {
      // 요청 주소에 좌표가 들어 있으므로 오류 원문 대신 이름만 남긴다
      this.logger.warn(`날씨 조회 실패: ${error?.name ?? 'error'}`);
      return null;
    }
  }

  /**
   * 기상청 날씨: 좌표를 격자로 바꿔 요청 격자로 기록하고(정기 작업이 이후 시간별로 수집),
   * DB에 최근 관측이 있으면 그것을 쓴다. 아직 없으면(처음 요청된 격자) 한 번 직접 조회해 저장한다.
   * 키가 없거나 실패하면 null. 좌표는 격자로 바꾸는 데만 쓰고 저장하지 않는다.
   */
  async currentFromKma({ latitude, longitude }) {
    const authKey = this.config.get('KMA_AUTH_KEY');
    if (!authKey || latitude === undefined || longitude === undefined) {
      return null;
    }
    const grid = toGrid(latitude, longitude);
    if (!grid) return null;
    try {
      await this.store.touchCell(grid);
      const stored = await this.store.latest(grid);
      if (stored) return stored;
      const fetched = await fetchKmaWeatherByGrid({
        authKey,
        grid,
        fetchImpl: this.fetchImpl,
        timeoutMs: KMA_TIMEOUT_MS,
      });
      if (fetched) await this.store.save(grid, fetched);
      return fetched;
    } catch (error) {
      // 요청 주소에 인증키·좌표가 들어 있으므로 오류 원문 대신 이름만 남긴다
      this.logger.warn(`기상청 날씨 조회 실패: ${error?.name ?? 'error'}`);
      return null;
    }
  }
}
