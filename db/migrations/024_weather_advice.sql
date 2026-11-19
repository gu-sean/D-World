-- 날씨 알림 (2026-11): 야외 활동이 어려운 날씨(비·눈·미세먼지)에 러닝 미션을 수정하도록 권하는 알림
--   1) user_weather_regions: 회원이 마지막으로 보낸 위치의 '격자 번호'와 '시도'만 저장한다(좌표는 저장하지 않는다).
--      날씨 알림이 어느 지역 날씨를 볼지 정하는 데 쓰고, 값이 없는 회원은 서울(60, 127)로 본다.
--   2) weather_grid_cells.sido: 격자가 속한 시도. 정기 작업이 그 시도의 미세먼지를 함께 수집한다.
--   3) air_quality_observations: 시도별 시간당 미세먼지(PM10·PM2.5, 측정소 평균). 에어코리아 값을 저장한다.
--   알림 자체는 기존 user_notifications(kind='system', event_key='weather_run:{날짜}')를 쓴다.
BEGIN;

CREATE TABLE user_weather_regions (
    user_id short_id PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nx smallint NOT NULL CHECK (nx BETWEEN 1 AND 149),
    ny smallint NOT NULL CHECK (ny BETWEEN 1 AND 253),
    sido varchar(8) NOT NULL CHECK (length(btrim(sido)) > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_weather_regions_grid_idx ON user_weather_regions (nx, ny);
COMMENT ON TABLE user_weather_regions IS
    '회원의 날씨 지역(격자·시도). 정확한 좌표는 저장하지 않는다. 없으면 서울로 본다.';

ALTER TABLE weather_grid_cells ADD COLUMN sido varchar(8);
COMMENT ON COLUMN weather_grid_cells.sido IS
    '격자가 속한 시도(에어코리아 시도 이름). 미세먼지를 시도 단위로 수집하는 데 쓴다.';

CREATE TABLE air_quality_observations (
    sido varchar(8) NOT NULL CHECK (length(btrim(sido)) > 0),
    observed_at timestamptz NOT NULL
        CHECK (observed_at = date_trunc('hour', observed_at)),
    pm10 smallint CHECK (pm10 BETWEEN 0 AND 1000),
    pm25 smallint CHECK (pm25 BETWEEN 0 AND 1000),
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (sido, observed_at),
    CHECK (pm10 IS NOT NULL OR pm25 IS NOT NULL)
);
CREATE INDEX air_quality_observations_observed_idx
    ON air_quality_observations (observed_at);
COMMENT ON TABLE air_quality_observations IS
    '시도별 미세먼지(측정소 평균) 시간당 1건. 같은 시간대는 다시 수집하면 덮어쓴다.';

ALTER TABLE user_weather_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_quality_observations ENABLE ROW LEVEL SECURITY;

COMMIT;
