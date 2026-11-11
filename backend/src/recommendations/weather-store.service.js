import { Dependencies, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** 요청이 이 시간 안에 있었던 격자만 정기 수집 대상 */
export const ACTIVE_WINDOW_HOURS = 24;
/** 관측 보관 기간 */
export const RETENTION_DAYS = 7;
/** 읽을 때 허용하는 관측 나이(정시 기준 한 시간대 + 수집 지연 여유) */
export const MAX_AGE_MINUTES = 120;
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

  /** 요청된 격자로 기록: 처음이면 등록, 아니면 마지막 요청 시각만 갱신 */
  async touchCell({ nx, ny }) {
    await this.database.query(
      `INSERT INTO weather_grid_cells (nx, ny) VALUES ($1, $2)
       ON CONFLICT (nx, ny) DO UPDATE
          SET last_requested_at = now()
        WHERE weather_grid_cells.last_requested_at < now() - ${TOUCH_INTERVAL}`,
      [nx, ny],
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
    return {
      purgedObservations: observations.rowCount,
      purgedCells: cells.rowCount,
    };
  }
}
