import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchKmaWeatherByGrid } from './kma-weather.js';
import { WeatherStoreService } from './weather-store.service.js';

/** 한 번 실행에 수집할 최대 격자 수, 남은 격자는 다음 주기(10분 뒤)에 이어서 처리 */
export const MAX_CELLS_PER_RUN = 200;
/** 기상청 동시 호출 수 */
const CONCURRENCY = 5;
export const COLLECT_TIMEOUT_MS = 8000;

/**
 * 시간별 날씨 수집 (WEATHER_DRIVER=kma일 때만)
 * 최근 요청이 있던 격자 중 이번 시간대 관측이 없는 곳만 조회해 저장한다.
 * 정기 작업이 10분마다 부르므로 실패한 격자는 다음 주기에 다시 시도되고, 이미 수집한 격자는 건너뛴다.
 */
@Injectable()
@Dependencies(ConfigService, WeatherStoreService)
export class WeatherCollectorService {
  logger = new Logger(WeatherCollectorService.name);

  constructor(config, store) {
    this.config = config;
    this.store = store;
    // 테스트에서 가짜 fetch를 넣을 수 있게 호출 시점에 전역 fetch를 찾음
    this.fetchImpl = (...args) => globalThis.fetch(...args);
  }

  /** @returns {Promise<{collected: number, failed: number}>} */
  async collect({ limit = MAX_CELLS_PER_RUN } = {}) {
    const authKey = this.config.get('KMA_AUTH_KEY');
    if (this.config.get('WEATHER_DRIVER') !== 'kma' || !authKey) {
      return { collected: 0, failed: 0 };
    }
    const cells = await this.store.pendingCells(limit);
    let collected = 0;
    let failed = 0;
    for (let i = 0; i < cells.length; i += CONCURRENCY) {
      const batch = cells.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((cell) => this.collectOne(authKey, cell)),
      );
      for (const ok of results) {
        if (ok) collected += 1;
        else failed += 1;
      }
    }
    if (failed > 0) {
      this.logger.warn(`날씨 수집 실패 ${failed}곳, 다음 주기에 다시 시도`);
    }
    return { collected, failed };
  }

  /** 격자 하나 수집, 어떤 실패도 던지지 않고 false (인증키·좌표가 주소에 있어 오류 원문은 남기지 않음) */
  async collectOne(authKey, cell) {
    try {
      const weather = await fetchKmaWeatherByGrid({
        authKey,
        grid: { nx: cell.nx, ny: cell.ny },
        fetchImpl: this.fetchImpl,
        timeoutMs: COLLECT_TIMEOUT_MS,
      });
      if (!weather) return false;
      await this.store.save(cell, weather);
      return true;
    } catch (error) {
      this.logger.warn(`날씨 수집 오류: ${error?.name ?? 'error'}`);
      return false;
    }
  }
}
