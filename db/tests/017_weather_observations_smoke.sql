-- smoke 017: 날씨 관측은 등록된 격자에만, 정시·허용 값만, 격자당 시간대 1건
BEGIN;

INSERT INTO weather_grid_cells (nx, ny) VALUES (60, 127);

DO $$
BEGIN
    -- 격자 범위 밖은 거절
    BEGIN
        INSERT INTO weather_grid_cells (nx, ny) VALUES (150, 127);
        RAISE EXCEPTION 'grid out of range accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- 등록되지 않은 격자의 관측은 거절
    BEGIN
        INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
        VALUES (61, 127, date_trunc('hour', now()), 'clear', 10);
        RAISE EXCEPTION 'observation for unknown cell accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    -- 정시가 아닌 시각은 거절
    BEGIN
        INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
        VALUES (60, 127, date_trunc('hour', now()) + interval '5 minutes', 'clear', 10);
        RAISE EXCEPTION 'non-hourly observation accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- 허용하지 않는 날씨 값은 거절
    BEGIN
        INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
        VALUES (60, 127, date_trunc('hour', now()), 'hail', 10);
        RAISE EXCEPTION 'unknown weather accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- 같은 격자·시간대는 한 건만
    INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
    VALUES (60, 127, date_trunc('hour', now()), 'clear', 10);
    BEGIN
        INSERT INTO weather_observations (nx, ny, observed_at, weather, temperature_c)
        VALUES (60, 127, date_trunc('hour', now()), 'rain', 9);
        RAISE EXCEPTION 'duplicate observation accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    -- 격자를 지우면 관측도 함께 지워짐
    DELETE FROM weather_grid_cells WHERE nx = 60 AND ny = 127;
    IF EXISTS (SELECT 1 FROM weather_observations WHERE nx = 60 AND ny = 127) THEN
        RAISE EXCEPTION 'observations survived cell delete';
    END IF;
END $$;

ROLLBACK;
