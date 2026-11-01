-- users 참조 FK는 모두 앞 컬럼이 일치하는 인덱스 필요 (탈퇴 시 전체 스캔 방지)
DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(c.conrelid::regclass::text, ', ') INTO missing
      FROM pg_constraint c
     WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass
       AND NOT EXISTS (
           SELECT 1 FROM pg_index i
            WHERE i.indrelid = c.conrelid
              AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'foreign keys to users without an index: %', missing;
    END IF;
END $$;
