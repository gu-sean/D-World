-- smoke: FK 인덱스 규칙, 전체 마이그레이션 뒤에 도는 전역 검사 (카탈로그만 읽음)
-- (1) users를 참조하는 모든 FK는 앞 컬럼이 일치하는 인덱스 필요 (탈퇴 시 전체 스캔 방지)
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

-- (2) 부모가 연쇄 삭제될 수 있는 FK(ON DELETE CASCADE·SET NULL)는 FK 컬럼으로 시작하는 인덱스 필요
--     기준 데이터와 admin_accounts 참조는 제외, 새 FK를 인덱스 없이 추가하면 실패
-- 앞으로 이런 FK를 새로 추가하면서 인덱스를 빼먹으면 이 테스트가 실패한다
DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(c.conrelid::regclass::text || ' (' || c.conname || ')', ', ')
      INTO missing
      FROM pg_constraint c
     WHERE c.contype = 'f'
       AND c.confdeltype IN ('c', 'n')
       AND c.confrelid NOT IN ('users'::regclass, 'admin_accounts'::regclass)
       AND NOT EXISTS (
           SELECT 1 FROM pg_index i
            WHERE i.indrelid = c.conrelid AND i.indkey[0] = ANY (c.conkey));
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'cascade-path foreign keys without an index: %', missing;
    END IF;
END $$;

-- 020이 만든 인덱스가 모두 유효(indisvalid)하다
DO $$
DECLARE invalid text;
BEGIN
    SELECT string_agg(c.relname, ', ') INTO invalid
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE NOT i.indisvalid;
    IF invalid IS NOT NULL THEN
        RAISE EXCEPTION 'invalid indexes: %', invalid;
    END IF;
END $$;
