-- 시간별 날씨 관측: 기상청 동네예보 5km 격자 단위로 매시간 수집해 저장
-- 개인정보: 좌표·사용자와 연결하지 않고 격자 번호(nx, ny)와 마지막 요청 시각만 둔다
BEGIN;

-- 수집 대상 격자: 상황 추천 요청이 들어온 격자, 최근에 요청된 것만 정기 작업이 수집
CREATE TABLE weather_grid_cells (
    nx smallint NOT NULL CHECK (nx BETWEEN 1 AND 149),
    ny smallint NOT NULL CHECK (ny BETWEEN 1 AND 253),
    first_requested_at timestamptz NOT NULL DEFAULT now(),
    last_requested_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (nx, ny),
    CHECK (last_requested_at >= first_requested_at)
);
CREATE INDEX weather_grid_cells_recent_idx
    ON weather_grid_cells (last_requested_at);

-- 격자별 시간대(정시로 내린 시각)당 1건, 같은 시간대는 다시 수집하면 덮어씀
CREATE TABLE weather_observations (
    nx smallint NOT NULL,
    ny smallint NOT NULL,
    observed_at timestamptz NOT NULL
        CHECK (observed_at = date_trunc('hour', observed_at)),
    weather varchar(16) NOT NULL
        CHECK (weather IN ('clear', 'clouds', 'rain', 'snow')),
    temperature_c smallint NOT NULL CHECK (temperature_c BETWEEN -80 AND 60),
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (nx, ny, observed_at),
    FOREIGN KEY (nx, ny) REFERENCES weather_grid_cells (nx, ny) ON DELETE CASCADE
);
-- 보관 기간이 지난 관측을 지우는 정기 작업용
CREATE INDEX weather_observations_observed_idx
    ON weather_observations (observed_at);

COMMIT;
