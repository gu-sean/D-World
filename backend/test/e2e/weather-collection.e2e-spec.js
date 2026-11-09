import { randomInt } from 'node:crypto';
import { createTestApp } from '../support/app.js';
import { JobsService } from '../../src/jobs/jobs.service.js';
import { WeatherClient } from '../../src/recommendations/weather.client.js';
import { WeatherCollectorService } from '../../src/recommendations/weather-collector.service.js';
import { WeatherStoreService } from '../../src/recommendations/weather-store.service.js';

// 시간별 날씨 수집·저장 (017 weather_grid_cells, weather_observations), 기상청은 가짜 fetch로 대체
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(0, 10); // 격자 nx 상한(149)을 넘지 않게

const ok = (items) => ({
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
    body: { items: { item: items } },
  },
});
const NCST = (t1h, pty = 0) =>
  ok([
    { category: 'T1H', obsrValue: String(t1h) },
    { category: 'PTY', obsrValue: String(pty) },
  ]);
const FCST = (sky) =>
  ok([
    { category: 'SKY', fcstDate: '20261109', fcstTime: '1100', fcstValue: sky },
  ]);

describe.skipIf(!databaseUrl)('시간별 날씨 수집 (PostgreSQL)', () => {
  let app;
  let db;
  let store;
  let collector;
  let client;
  let calls;
  let failNx; // 이 nx 격자는 기상청 오류로 응답

  /** 격자마다 다른 기온을 주는 가짜 기상청: 기온 = nx 끝 두 자리 */
  const fakeFetch = async (url) => {
    const u = new URL(url);
    calls.push(`${u.pathname.split('/').pop()}:${u.searchParams.get('nx')}`);
    if (failNx !== undefined && u.searchParams.get('nx') === String(failNx)) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    const nx = Number(u.searchParams.get('nx'));
    const isNcst = u.pathname.endsWith('getUltraSrtNcst');
    return {
      ok: true,
      status: 200,
      json: async () => (isNcst ? NCST(nx % 100) : FCST('1')),
    };
  };

  const useKma = (target) => {
    target.config = {
      get: (key) =>
        ({ WEATHER_DRIVER: 'kma', KMA_AUTH_KEY: 'test-key' })[key] ?? undefined,
    };
  };

  const observations = async (nx, ny) =>
    (
      await db.query(
        `SELECT weather, temperature_c, observed_at = date_trunc('hour', now()) AS this_hour
           FROM weather_observations WHERE nx = $1 AND ny = $2 ORDER BY observed_at`,
        [nx, ny],
      )
    ).rows;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    store = app.get(WeatherStoreService);
    collector = app.get(WeatherCollectorService);
    client = app.get(WeatherClient);
    useKma(collector);
    useKma(client);
    collector.fetchImpl = fakeFetch;
    client.fetchImpl = fakeFetch;
    // 이 테스트 전용 DB라 이전 실행의 격자가 수집 대상에 섞이지 않게 비움
    await db.query('DELETE FROM weather_grid_cells');
  });

  beforeEach(async () => {
    calls = [];
    failNx = undefined;
    await db.query('DELETE FROM weather_grid_cells');
  });

  afterAll(async () => {
    await db.query('DELETE FROM weather_grid_cells');
    await app.close();
  });

  it('요청된 격자만 수집하고, 같은 시간대엔 다시 부르지 않음', async () => {
    const a = { nx: 100 + RUN, ny: 80 };
    const b = { nx: 101 + RUN, ny: 80 };
    await store.touchCell(a);
    await store.touchCell(b);

    expect(await collector.collect()).toEqual({ collected: 2, failed: 0 });
    expect(await observations(a.nx, a.ny)).toEqual([
      { weather: 'clear', temperature_c: a.nx % 100, this_hour: true },
    ]);
    expect((await observations(b.nx, b.ny))[0].temperature_c).toBe(b.nx % 100);
    // 격자마다 실황·예보 한 번씩
    expect(calls).toHaveLength(4);

    calls = [];
    expect(await collector.collect()).toEqual({ collected: 0, failed: 0 });
    expect(calls).toHaveLength(0);
  });

  it('실패한 격자는 저장하지 않고 다음 주기에 다시 시도', async () => {
    const good = { nx: 100 + RUN, ny: 81 };
    const bad = { nx: 102 + RUN, ny: 81 };
    await store.touchCell(good);
    await store.touchCell(bad);
    failNx = bad.nx;

    expect(await collector.collect()).toEqual({ collected: 1, failed: 1 });
    expect(await observations(bad.nx, bad.ny)).toEqual([]);

    failNx = undefined;
    calls = [];
    expect(await collector.collect()).toEqual({ collected: 1, failed: 0 });
    expect(calls.every((call) => call.endsWith(`:${bad.nx}`))).toBe(true);
    expect(await observations(bad.nx, bad.ny)).toHaveLength(1);
  });

  it('24시간 넘게 요청 없던 격자는 수집하지 않고, limit만큼만 처리', async () => {
    const stale = { nx: 103 + RUN, ny: 82 };
    await store.touchCell(stale);
    await db.query(
      `UPDATE weather_grid_cells
          SET first_requested_at = now() - interval '3 days',
              last_requested_at = now() - interval '25 hours'
        WHERE nx = $1 AND ny = $2`,
      [stale.nx, stale.ny],
    );
    expect(await collector.collect()).toEqual({ collected: 0, failed: 0 });

    for (let i = 0; i < 3; i += 1) {
      await store.touchCell({ nx: 104 + RUN + i, ny: 82 });
    }
    expect(await collector.collect({ limit: 2 })).toEqual({
      collected: 2,
      failed: 0,
    });
    expect(await collector.collect({ limit: 2 })).toEqual({
      collected: 1,
      failed: 0,
    });
  });

  it('드라이버가 kma가 아니거나 키가 없으면 아무것도 하지 않음', async () => {
    await store.touchCell({ nx: 110 + RUN, ny: 83 });
    const original = collector.config;
    collector.config = { get: () => undefined };
    expect(await collector.collect()).toEqual({ collected: 0, failed: 0 });
    collector.config = {
      get: (key) => (key === 'WEATHER_DRIVER' ? 'kma' : undefined),
    };
    expect(await collector.collect()).toEqual({ collected: 0, failed: 0 });
    expect(calls).toHaveLength(0);
    collector.config = original;
  });

  it('저장소: 최근 관측만 읽고, 같은 시간대는 덮어씀', async () => {
    const cell = { nx: 120 + RUN, ny: 84 };
    expect(await store.latest(cell)).toBeNull();

    await store.save(cell, { weather: 'rain', temperatureC: 3 });
    expect(await store.latest(cell)).toEqual({
      weather: 'rain',
      temperatureC: 3,
    });
    await store.save(cell, { weather: 'clouds', temperatureC: 4 });
    expect(await store.latest(cell)).toEqual({
      weather: 'clouds',
      temperatureC: 4,
    });
    expect(await observations(cell.nx, cell.ny)).toHaveLength(1);

    // 3시간 전 관측만 있으면 오래돼서 읽지 않음
    await db.query(
      'DELETE FROM weather_observations WHERE nx = $1 AND ny = $2',
      [cell.nx, cell.ny],
    );
    await db.query(
      `INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
       VALUES ($1, $2, date_trunc('hour', now() - interval '3 hours'), 'clear', 9)`,
      [cell.nx, cell.ny],
    );
    expect(await store.latest(cell)).toBeNull();
  });

  it('요청 시각 갱신은 10분 안에는 다시 쓰지 않음', async () => {
    const cell = { nx: 121 + RUN, ny: 84 };
    await store.touchCell(cell);
    const read = async () =>
      (
        await db.query(
          'SELECT last_requested_at FROM weather_grid_cells WHERE nx = $1 AND ny = $2',
          [cell.nx, cell.ny],
        )
      ).rows[0].last_requested_at;
    const first = await read();
    await store.touchCell(cell);
    expect(await read()).toEqual(first);

    await db.query(
      `UPDATE weather_grid_cells
          SET first_requested_at = now() - interval '2 hours',
              last_requested_at = now() - interval '20 minutes'
        WHERE nx = $1 AND ny = $2`,
      [cell.nx, cell.ny],
    );
    const old = await read();
    await store.touchCell(cell);
    expect((await read()).getTime()).toBeGreaterThan(old.getTime());
  });

  it('추천용 조회: 처음 요청된 격자는 직접 조회해 저장, 이후엔 DB에서 읽음', async () => {
    // 서울 시청 → 격자 (60, 127)
    const seoul = { latitude: 37.5665, longitude: 126.978 };
    expect(await client.current(seoul)).toEqual({
      weather: 'clear',
      temperatureC: 60,
    });
    expect(calls).toHaveLength(2);
    expect(await observations(60, 127)).toHaveLength(1);

    calls = [];
    expect(await client.current(seoul)).toEqual({
      weather: 'clear',
      temperatureC: 60,
    });
    expect(calls).toHaveLength(0);

    // 요청된 격자는 정기 수집 대상이라, 다음 시간대에 수집됨 (여기선 이번 시간대 관측이 이미 있어 대기 목록에 없음)
    expect(await store.pendingCells(10)).toEqual([]);
  });

  it('추천용 조회: 기상청 실패는 null, 격자 밖 좌표는 기록 없이 null', async () => {
    failNx = 60;
    expect(
      await client.current({ latitude: 37.5665, longitude: 126.978 }),
    ).toBeNull();
    // 요청된 격자로는 남아 다음 정기 수집이 다시 시도
    expect((await store.pendingCells(10)).map((c) => [c.nx, c.ny])).toEqual([
      [60, 127],
    ]);

    await db.query('DELETE FROM weather_grid_cells');
    expect(
      await client.current({ latitude: 35.68, longitude: 139.69 }),
    ).toBeNull();
    expect(await store.pendingCells(10)).toEqual([]);
  });

  it('보관 기간이 지난 관측과 오래 요청 없는 격자를 삭제', async () => {
    const keep = { nx: 130 + RUN, ny: 85 };
    const old = { nx: 131 + RUN, ny: 85 };
    await store.touchCell(keep);
    await store.save(keep, { weather: 'clear', temperatureC: 1 });
    await store.touchCell(old);
    await db.query(
      `UPDATE weather_grid_cells
          SET first_requested_at = now() - interval '20 days',
              last_requested_at = now() - interval '9 days'
        WHERE nx = $1 AND ny = $2`,
      [old.nx, old.ny],
    );
    await db.query(
      `INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
       VALUES ($1, $2, date_trunc('hour', now() - interval '9 days'), 'snow', -2),
              ($3, $4, date_trunc('hour', now() - interval '8 days'), 'rain', 5)`,
      [old.nx, old.ny, keep.nx, keep.ny],
    );

    expect(await store.purge()).toEqual({
      purgedObservations: 2,
      purgedCells: 1,
    });
    expect(await observations(keep.nx, keep.ny)).toHaveLength(1);
    const { rows } = await db.query(
      'SELECT 1 FROM weather_grid_cells WHERE nx = $1 AND ny = $2',
      [old.nx, old.ny],
    );
    expect(rows).toHaveLength(0);
  });

  it('정기 작업으로 등록되어 있고 수동 실행이 가능', async () => {
    const jobs = app.get(JobsService);
    expect(jobs.names()).toEqual(
      expect.arrayContaining(['weather-collect', 'weather-purge']),
    );
    await store.touchCell({ nx: 140 + RUN, ny: 86 });
    expect(await jobs.runJob('weather-collect')).toEqual({
      collected: 1,
      failed: 0,
    });
    expect(await jobs.runJob('weather-purge')).toEqual({
      purgedObservations: 0,
      purgedCells: 0,
    });
  });
});
