import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { createSystemNotification } from '../notices/system-notification.js';
import { isBadAir } from './air-quality.js';
import { DEFAULT_REGION } from './korea-regions.js';
import { WeatherStoreService } from './weather-store.service.js';

/** 알림을 보내는 한국 시각: 06시 이상 22시 미만 */
export const ADVICE_FIRST_HOUR = 6;
export const ADVICE_LAST_HOUR = 22;

export const ADVICE_TITLE = '오늘은 야외 러닝이 어려울 수 있어요';
export const ADVICE_BODY =
  '비·눈·미세먼지 때문에 오늘 러닝 미션을 실내 운동으로 바꿔 보세요';

/** 하루에 한 번만 보내도록 날짜별로 같은 키를 쓴다 (user_notifications의 (user_id, event_key) 중복 방지) */
export const adviceEventKey = (date) => `weather_run:${date}`;

/** 야외 활동이 어려운 날씨인지: 비·눈, 또는 미세먼지 '나쁨' 이상(PM10 81·PM2.5 36 이상) */
export function isOutdoorDiscouraged({ weather, air } = {}) {
  return weather === 'rain' || weather === 'snow' || isBadAir(air ?? {});
}

/** 한국 시각(0~23) */
export const kstHourOf = (at) => (at.getUTCHours() + 9) % 24;

/**
 * 날씨 알림: 야외 활동이 어려운 날씨면 오늘 러닝 미션이 있는 회원에게 수정(실내 운동으로 변경)을 권한다.
 * - 대상: 오늘(KST) 아직 하지 않은(scheduled·in_progress) 러닝 미션이 있는 회원. 챌린지 미션은 바꿀 수 없어 제외한다.
 * - 지역: 회원이 마지막으로 보낸 위치의 격자·시도, 없으면 서울.
 * - 날씨 관측(최근 2시간)과 미세먼지(최근 3시간)가 모두 없으면 알리지 않는다.
 * - 06~22시에만, 하루에 한 번만(event_key `weather_run:{날짜}`) 보낸다. 알림을 누르면 그 러닝 미션으로 이동한다.
 */
@Injectable()
@Dependencies(DatabaseService, WeatherStoreService)
export class WeatherAdviceService {
  logger = new Logger(WeatherAdviceService.name);

  constructor(database, store) {
    this.database = database;
    this.store = store;
  }

  /** @returns {Promise<{checked: number, notified: number, skipped?: string}>} */
  async run({ now = new Date() } = {}) {
    const hour = kstHourOf(now);
    if (hour < ADVICE_FIRST_HOUR || hour >= ADVICE_LAST_HOUR) {
      return { checked: 0, notified: 0, skipped: 'quiet_hours' };
    }
    const date = kstDate(now);
    const eventKey = adviceEventKey(date);
    const { rows } = await this.database.query(
      `SELECT DISTINCT ON (m.user_id) m.user_id, m.id AS mission_id, r.nx, r.ny, r.sido
         FROM missions m
         LEFT JOIN user_weather_regions r ON r.user_id = m.user_id
        WHERE m.exercise_code = 'running'
          AND m.scheduled_date = $1::date
          AND m.deleted_at IS NULL
          AND m.status IN ('scheduled', 'in_progress')
          AND NOT EXISTS (SELECT 1 FROM challenge_daily_missions dm WHERE dm.mission_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM user_notifications n
                           WHERE n.user_id = m.user_id AND n.event_key = $2)
        ORDER BY m.user_id, m.created_at, m.id`,
      [date, eventKey],
    );

    // 같은 격자·시도는 한 번만 읽는다
    const weatherByGrid = new Map();
    const airBySido = new Map();
    const weatherOf = async ({ nx, ny }) => {
      const key = `${nx}:${ny}`;
      if (!weatherByGrid.has(key)) {
        weatherByGrid.set(key, await this.store.latest({ nx, ny }));
      }
      return weatherByGrid.get(key);
    };
    const airOf = async (sido) => {
      if (!airBySido.has(sido)) {
        airBySido.set(sido, await this.store.latestAir(sido));
      }
      return airBySido.get(sido);
    };

    let notified = 0;
    for (const row of rows) {
      const region = row.nx ? row : DEFAULT_REGION;
      const [weather, air] = await Promise.all([
        weatherOf(region),
        airOf(region.sido),
      ]);
      if (!weather && !air) continue; // 모르는 날씨로는 알리지 않는다
      if (!isOutdoorDiscouraged({ weather: weather?.weather, air })) continue;
      await createSystemNotification(this.database, {
        userId: row.user_id,
        eventKey,
        title: ADVICE_TITLE,
        body: ADVICE_BODY,
        linkScreen: `missions/${row.mission_id}`,
      });
      notified += 1;
    }
    if (notified > 0) {
      this.logger.log(`날씨 알림 ${notified}명 (대상 ${rows.length}명)`);
    }
    return { checked: rows.length, notified };
  }
}
