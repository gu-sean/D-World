-- 추천 문구 개편 (2026-11): 우선순위·조건 대신 요일별 문구
--   1) weekday: 1=월 … 7=일(한국 요일), NULL=매일.
--      홈 화면은 오늘 요일의 문구를 보여 준다(여러 개면 사용자·날짜마다 정해진 하나). 오늘 요일의 문구가 없으면
--      '매일' 문구, 그것도 없으면 기본 문구를 쓴다.
--   2) 조건(항상·미션 없음·연속 위험·미접속·시간대)과 우선순위는 없앤다.
--      조건이 '항상'이던 문구는 '매일' 문구로 남기고, 다른 조건이던 문구는 뜻이 달라지므로 꺼 둔다(기록은 남김).
--   3) 요일별 기본 문구 7개를 넣는다(관리자 계정이 있을 때만).
BEGIN;

ALTER TABLE recommendation_messages
    ADD COLUMN weekday smallint CHECK (weekday BETWEEN 1 AND 7);

UPDATE recommendation_messages
   SET is_active = false, updated_at = now()
 WHERE condition_type <> 'always' AND is_active;

DROP INDEX recommendation_messages_active_idx;
ALTER TABLE recommendation_messages
    DROP COLUMN priority,
    DROP COLUMN condition_type,
    DROP COLUMN condition_params;
CREATE INDEX recommendation_messages_active_idx
    ON recommendation_messages (weekday, id) WHERE is_active;

COMMENT ON COLUMN recommendation_messages.weekday IS
    '문구를 보여 줄 한국 요일(1=월 … 7=일). NULL이면 매일 보여 주는 문구.';

INSERT INTO recommendation_messages
       (id, message, weekday, is_active, created_by_admin_id, updated_by_admin_id)
SELECT new_short_id(), v.message, v.weekday, true, a.id, a.id
  FROM (VALUES
          (1, '새로운 한 주가 시작됐어요. 가볍게 시작해 볼까요?'),
          (2, '어제보다 한 걸음만 더 가 봐요.'),
          (3, '한 주의 절반이 지났어요. 오늘도 미션 하나만 해요!'),
          (4, '꾸준함이 쌓이고 있어요. 오늘도 한 번 해 볼까요?'),
          (5, '이번 주의 마지막 평일이에요. 멋지게 마무리해요!'),
          (6, '주말엔 여유롭게, 몸을 가볍게 풀어 봐요.'),
          (7, '푹 쉬고 다음 주를 준비해요. 가벼운 스트레칭 어때요?')
       ) AS v(weekday, message)
 CROSS JOIN (SELECT id FROM admin_accounts ORDER BY created_at LIMIT 1) a;

COMMIT;
