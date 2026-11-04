-- 개발용 시드

\if :{?admin_password_hash}
\else
    \echo 'Set -v admin_password_hash=<hash> before running this seed.'
    \quit
\endif

BEGIN;

-- 관리자
INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('d0000000-0000-4000-8000-000000000001', 'dev_admin',
        'dev-admin@example.test', :'admin_password_hash')
ON CONFLICT DO NOTHING;

-- 약관·개인정보·마케팅 문서
INSERT INTO policy_document_versions
    (id, document_type, version, body, effective_at, requires_reconsent, published_at)
SELECT gen_random_uuid(), t.document_type, 'dev-1',
       '[DEV] ' || t.document_type || ' placeholder text.',
       timestamptz '2026-01-01 00:00:00+09', false, timestamptz '2026-01-01 00:00:00+09'
  FROM (VALUES ('terms'), ('privacy'), ('marketing')) AS t(document_type)
ON CONFLICT (document_type, version) DO NOTHING;

-- 카테고리와 난이도
INSERT INTO goal_categories (id, code, name, display_order) VALUES
    ('d0000000-0000-4000-8000-000000000011', 'exercise',  '운동',     1),
    ('d0000000-0000-4000-8000-000000000012', 'study',     '학습',     2),
    ('d0000000-0000-4000-8000-000000000013', 'lifestyle', '생활습관', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO difficulty_levels (id, code, name, display_order) VALUES
    (gen_random_uuid(), 'easy',   '쉬움',   1),
    (gen_random_uuid(), 'normal', '보통',   2),
    (gen_random_uuid(), 'hard',   '어려움', 3)
ON CONFLICT (code) DO NOTHING;

-- 인증 기준 v1: 빈 규칙 = AI 서버 기본값 사용 (docs/10 §5)
INSERT INTO verification_criteria_versions
    (id, category_id, verification_method, version_no, rules_json,
     effective_at, created_by_admin_id)
SELECT gen_random_uuid(), c.id, m.method, 1,
       '{}'::jsonb,
       timestamptz '2026-01-01 00:00:00+09',
       'd0000000-0000-4000-8000-000000000001'
  FROM goal_categories c
 CROSS JOIN (VALUES ('camera'), ('sensor')) AS m(method)
ON CONFLICT (category_id, verification_method, version_no) DO NOTHING;

-- 미션 보상표 v1: 난이도별 10/20/30 P
INSERT INTO mission_reward_rate_versions
    (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
     effective_at, created_by_admin_id)
SELECT gen_random_uuid(), c.id, d.id, 1,
       CASE d.code WHEN 'easy' THEN 10 WHEN 'normal' THEN 20 ELSE 30 END,
       CASE d.code WHEN 'easy' THEN 10 WHEN 'normal' THEN 20 ELSE 30 END,
       CASE d.code WHEN 'easy' THEN  5 WHEN 'normal' THEN 10 ELSE 15 END,
       timestamptz '2026-01-01 00:00:00+09',
       'd0000000-0000-4000-8000-000000000001'
  FROM goal_categories c
 CROSS JOIN difficulty_levels d
ON CONFLICT (category_id, difficulty_id, version_no) DO NOTHING;

-- 스트릭 마일스톤 보상
INSERT INTO streak_milestone_policy_versions
    (id, target_success_days, version_no, points, user_xp, pet_xp,
     effective_at, created_by_admin_id)
SELECT gen_random_uuid(), t.days, 1, t.points, 0, 0,
       timestamptz '2026-01-01 00:00:00+09',
       'd0000000-0000-4000-8000-000000000001'
  FROM (VALUES (7, 70), (30, 300), (100, 1000)) AS t(days, points)
ON CONFLICT (target_success_days, version_no) DO NOTHING;

-- 레벨 임곗값 v1: n레벨 시작 XP = 50*n*(n-1), 10레벨 (트리거 때문에 레벨마다 삽입)
DO $$
DECLARE
    policy_id uuid;
    lvl integer;
BEGIN
    INSERT INTO user_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
    VALUES (gen_random_uuid(), 1, timestamptz '2026-01-01 00:00:00+09',
            'd0000000-0000-4000-8000-000000000001')
    ON CONFLICT (version_no) DO NOTHING
    RETURNING id INTO policy_id;
    IF policy_id IS NOT NULL THEN
        FOR lvl IN 1..10 LOOP
            INSERT INTO user_level_thresholds (policy_version_id, level_no, min_total_xp)
            VALUES (policy_id, lvl, 50 * lvl * (lvl - 1));
        END LOOP;
    END IF;

    policy_id := NULL;
    INSERT INTO pet_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
    VALUES (gen_random_uuid(), 1, timestamptz '2026-01-01 00:00:00+09',
            'd0000000-0000-4000-8000-000000000001')
    ON CONFLICT (version_no) DO NOTHING
    RETURNING id INTO policy_id;
    IF policy_id IS NOT NULL THEN
        FOR lvl IN 1..10 LOOP
            INSERT INTO pet_level_thresholds (policy_version_id, level_no, min_total_xp)
            VALUES (policy_id, lvl, 50 * lvl * (lvl - 1));
        END LOOP;
    END IF;
END $$;

COMMIT;
