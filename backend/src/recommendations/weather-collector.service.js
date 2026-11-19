import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchAirKoreaBySido } from './air-quality.js';
import { fetchKmaWeatherByGrid } from './kma-weather.js';
import { DEFAULT_REGION } from './korea-regions.js';
import { WeatherStoreService } from './weather-store.service.js';

/** 한 번 실행에 수집할 최대 격자 수, 남은 격자는 다음 주기에 이어서 처리 */
export const MAX_CELLS_PER_RUN = 200;
/** 기상청 동시 호출 수 */
const CONCURRENCY = 5;
export const COLLECT_TIMEOUT_MS = 8000;
/** 한 번 실행에 수집할 최대 시도 수(전국 17곳) */
const MAX_SIDOS_PER_RUN = 20;

/**
 * 시간별 날씨·미세먼지 수집
 * - 날씨(WEATHER_DRIVER=kma): 최근 요청이 있던 격자와 회원들의 지역·기본 지역(서울) 중
 *   이번 시간대 관측이 없는 곳만 조회해 저장한다.
 * - 미세먼지(AIR_DRIVER=airkorea): 그 격자가 속한 시도의 미세먼지를 시도당 한 번 저장한다.
 * 정기 작업이 매시간 부르며, 이미 수집한 곳은 건너뛰고 실패한 곳은 다음 주기에 다시 시도한다.
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

  /**
   * 회원들의 지역과 기본 지역(서울)을 수집 대상으로 올려 둔다
   * (위치를 보낸 적 없는 회원도 서울 날씨로 알림을 받도록). 수집 전에 정기 작업이 부른다.
   */
  async trackRegions() {
    await this.store.ensureTrackedCells(DEFAULT_REGION);
  }

  /** @returns {Promise<{collected: number, failed: number, airCollected: number, airFailed: number}>} */
  async collect({ limit = MAX_CELLS_PER_RUN } = {}) {
    const authKey = this.config.get('KMA_AUTH_KEY');
    const weatherOn =
      this.config.get('WEATHER_DRIVER') === 'kma' && Boolean(authKey);
    const airKey = this.config.get('AIRKOREA_SERVICE_KEY');
    const airOn =
      this.config.get('AIR_DRIVER') === 'airkorea' && Boolean(airKey);
    if (!weatherOn && !airOn) {
      return { collected: 0, failed: 0, airCollected: 0, airFailed: 0 };
    }
    let collected = 0;
    let failed = 0;
    if (weatherOn) {
      const cells = await this.store.pendingCells(limit);
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
    }

    let airCollected = 0;
    let airFailed = 0;
    if (airOn) {
      const sidos = await this.store.pendingAirSidos(MAX_SIDOS_PER_RUN);
      for (const sido of sidos) {
        if (await this.collectAirOne(airKey, sido)) airCollected += 1;
        else airFailed += 1;
      }
      if (airFailed > 0) {
        this.logger.warn(
          `미세먼지 수집 실패 ${airFailed}곳, 다음 주기에 다시 시도`,
        );
      }
    }
    return { collected, failed, airCollected, airFailed };
  }

  /** 시도 하나의 미세먼지 수집, 어떤 실패도 던지지 않고 false (서비스 키가 주소에 있어 오류 원문은 남기지 않음) */
  async collectAirOne(serviceKey, sido) {
    try {
      const air = await fetchAirKoreaBySido({
        serviceKey,
        sido,
        fetchImpl: this.fetchImpl,
        timeoutMs: COLLECT_TIMEOUT_MS,
      });
      if (!air) return false;
      await this.store.saveAir(sido, air);
      return true;
    } catch (error) {
      this.logger.warn(`미세먼지 수집 오류: ${error?.name ?? 'error'}`);
      return false;
    }
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
