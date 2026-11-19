import { Dependencies, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** 요청이 이 시간 안에 있었던 격자만 정기 수집 대상 */
export const ACTIVE_WINDOW_HOURS = 24;
/** 관측 보관 기간 */
export const RETENTION_DAYS = 7;
/** 읽을 때 허용하는 관측 나이(정시 기준 한 시간대 + 수집 지연 여유) */
export const MAX_AGE_MINUTES = 120;
/** 미세먼지 관측은 한 시간 늦게 올라오는 일이 있어 세 시간까지 허용 */
export const MAX_AIR_AGE_MINUTES = 180;
// 같은 격자의 요청 시각은 이 간격 안에서는 다시 쓰지 않음(요청마다 같은 행을 갱신하지 않도록)
const TOUCH_INTERVAL = "interval '10 minutes'";

/**
 * 시간별 날씨 저장소 (017 weather_grid_cells·weather_observations)
 * 격자 번호와 시각만 다루고 좌표·사용자는 저장하지 않는다.
 */
@Injectable()
@Dependencies(DatabaseService)
export class WeatherStoreService {
  constructor(database) {
    this.database = database;
  }

  /** 요청된 격자로 기록: 처음이면 등록, 아니면 마지막 요청 시각만 갱신(시도를 아직 모르면 채움) */
  async touchCell({ nx, ny }, sido = null) {
    await this.database.query(
      `INSERT INTO weather_grid_cells (nx, ny, sido) VALUES ($1, $2, $3)
       ON CONFLICT (nx, ny) DO UPDATE
          SET last_requested_at = now(),
              sido = COALESCE(weather_grid_cells.sido, EXCLUDED.sido)
        WHERE weather_grid_cells.last_requested_at < now() - ${TOUCH_INTERVAL}
           OR (weather_grid_cells.sido IS NULL AND EXCLUDED.sido IS NOT NULL)`,
      [nx, ny, sido],
    );
  }

  /**
   * 회원의 날씨 지역(격자·시도) 기록: 날씨 알림이 어느 지역 날씨를 볼지 정하는 데 쓴다
   * 좌표는 저장하지 않고 같은 값이면 다시 쓰지 않는다.
   */
  async saveUserRegion(userId, { nx, ny, sido }) {
    await this.database.query(
      `INSERT INTO user_weather_regions (user_id, nx, ny, sido) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
          SET nx = EXCLUDED.nx, ny = EXCLUDED.ny, sido = EXCLUDED.sido, updated_at = now()
        WHERE (user_weather_regions.nx, user_weather_regions.ny, user_weather_regions.sido)
              IS DISTINCT FROM (EXCLUDED.nx, EXCLUDED.ny, EXCLUDED.sido)`,
      [userId, nx, ny, sido],
    );
  }

  /** 회원의 날씨 지역, 없으면 null */
  async regionOf(userId) {
    const { rows } = await this.database.query(
      'SELECT nx, ny, sido FROM user_weather_regions WHERE user_id = $1',
      [userId],
    );
    return rows[0] ?? null;
  }

  /**
   * 정기 수집 대상 격자를 최신으로: 회원들의 지역과 기본 지역(서울)을 '최근 요청'으로 표시한다
   * (위치를 한 번도 보내지 않은 회원도 기본 지역 날씨로 알림을 받도록 항상 수집한다)
   */
  async ensureTrackedCells(defaultRegion) {
    await this.database.query(
      `INSERT INTO weather_grid_cells (nx, ny, sido)
       SELECT nx, ny, min(sido) FROM (
                SELECT nx, ny, sido FROM user_weather_regions
                UNION ALL
                SELECT $1::smallint, $2::smallint, $3::varchar) t
        GROUP BY nx, ny
       ON CONFLICT (nx, ny) DO UPDATE
          SET last_requested_at = now(),
              sido = COALESCE(weather_grid_cells.sido, EXCLUDED.sido)`,
      [defaultRegion.nx, defaultRegion.ny, defaultRegion.sido],
    );
  }

  /** 가장 최근 관측, MAX_AGE_MINUTES보다 오래됐으면 null */
  async latest({ nx, ny }) {
    const { rows } = await this.database.query(
      `SELECT weather, temperature_c
         FROM weather_observations
        WHERE nx = $1 AND ny = $2
          AND observed_at > now() - make_interval(mins => $3)
        ORDER BY observed_at DESC
        LIMIT 1`,
      [nx, ny, MAX_AGE_MINUTES],
    );
    return rows[0]
      ? { weather: rows[0].weather, temperatureC: rows[0].temperature_c }
      : null;
  }

  /** 지금 시간대의 관측 저장(같은 시간대는 덮어씀), 격자가 없으면 함께 등록 */
  async save({ nx, ny }, { weather, temperatureC }) {
    await this.database.withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO weather_grid_cells (nx, ny) VALUES ($1, $2)
         ON CONFLICT (nx, ny) DO NOTHING`,
        [nx, ny],
      );
      await tx.query(
        `INSERT INTO weather_observations
                (nx, ny, observed_at, weather, temperature_c)
         VALUES ($1, $2, date_trunc('hour', now()), $3, $4)
         ON CONFLICT (nx, ny, observed_at) DO UPDATE
            SET weather = EXCLUDED.weather,
                temperature_c = EXCLUDED.temperature_c,
                fetched_at = now()`,
        [nx, ny, weather, temperatureC],
      );
    });
  }

  /** 최근 요청이 있었고 이번 시간대 관측이 아직 없는 격자, 최근 요청 순 */
  async pendingCells(limit) {
    const { rows } = await this.database.query(
      `SELECT c.nx, c.ny
         FROM weather_grid_cells c
        WHERE c.last_requested_at > now() - make_interval(hours => $1)
          AND NOT EXISTS (
                SELECT 1 FROM weather_observations o
                 WHERE o.nx = c.nx AND o.ny = c.ny
                   AND o.observed_at = date_trunc('hour', now()))
        ORDER BY c.last_requested_at DESC
        LIMIT $2`,
      [ACTIVE_WINDOW_HOURS, limit],
    );
    return rows;
  }

  /** 이번 시간대 미세먼지가 아직 없는 시도(수집 대상 격자가 속한 시도만) */
  async pendingAirSidos(limit) {
    const { rows } = await this.database.query(
      `SELECT DISTINCT c.sido
         FROM weather_grid_cells c
        WHERE c.sido IS NOT NULL
          AND c.last_requested_at > now() - make_interval(hours => $1)
          AND NOT EXISTS (
                SELECT 1 FROM air_quality_observations a
                 WHERE a.sido = c.sido AND a.observed_at = date_trunc('hour', now()))
        LIMIT $2`,
      [ACTIVE_WINDOW_HOURS, limit],
    );
    return rows.map((row) => row.sido);
  }

  /** 지금 시간대의 시도 미세먼지 저장(같은 시간대는 덮어씀) */
  async saveAir(sido, { pm10, pm25 }) {
    await this.database.query(
      `INSERT INTO air_quality_observations (sido, observed_at, pm10, pm25)
       VALUES ($1, date_trunc('hour', now()), $2, $3)
       ON CONFLICT (sido, observed_at) DO UPDATE
          SET pm10 = EXCLUDED.pm10, pm25 = EXCLUDED.pm25, fetched_at = now()`,
      [sido, pm10, pm25],
    );
  }

  /** 가장 최근 시도 미세먼지, MAX_AIR_AGE_MINUTES보다 오래됐으면 null */
  async latestAir(sido) {
    const { rows } = await this.database.query(
      `SELECT pm10, pm25 FROM air_quality_observations
        WHERE sido = $1 AND observed_at > now() - make_interval(mins => $2)
        ORDER BY observed_at DESC LIMIT 1`,
      [sido, MAX_AIR_AGE_MINUTES],
    );
    return rows[0] ? { pm10: rows[0].pm10, pm25: rows[0].pm25 } : null;
  }

  /**
   * 보관 기간이 지난 관측 삭제, 오래 요청이 없는 격자도 정리(관측은 연쇄 삭제)
   * 한 번에 limit건씩 지워 긴 잠금을 피하고 남은 건은 다음 주기에 이어서 처리
   */
  async purge({ limit = 5000 } = {}) {
    const observations = await this.database.query(
      `DELETE FROM weather_observations
        WHERE (nx, ny, observed_at) IN (
              SELECT nx, ny, observed_at FROM weather_observations
               WHERE observed_at < now() - make_interval(days => $1)
               ORDER BY observed_at
               LIMIT $2)`,
      [RETENTION_DAYS, limit],
    );
    const cells = await this.database.query(
      `DELETE FROM weather_grid_cells
        WHERE (nx, ny) IN (
              SELECT nx, ny FROM weather_grid_cells
               WHERE last_requested_at < now() - make_interval(days => $1)
               LIMIT $2)`,
      [RETENTION_DAYS, limit],
    );
    const air = await this.database.query(
      `DELETE FROM air_quality_observations
        WHERE (sido, observed_at) IN (
              SELECT sido, observed_at FROM air_quality_observations
               WHERE observed_at < now() - make_interval(days => $1)
               ORDER BY observed_at
               LIMIT $2)`,
      [RETENTION_DAYS, limit],
    );
    return {
      purgedObservations: observations.rowCount,
      purgedCells: cells.rowCount,
      purgedAir: air.rowCount,
    };
  }
}
