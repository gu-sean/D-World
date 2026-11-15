-- 난이도 추천 표의 행 수준 보안 켜기 + 새 표·컬럼 설명 추가 (구조·데이터 변경 없음)
--   019_fitness_difficulty_agents.sql이 만든 difficulty_recommendation_runs만 행 수준 보안(RLS)이 꺼져 있어
--   다른 94개 표와 같게 맞춘다. 정책은 두지 않는다 — 백엔드(표 소유자)는 RLS를 거치지 않고,
--   앱·공개 API 역할(anon, authenticated)은 이 표를 읽을 수 없는 지금 상태를 계속 지킨다.
--   019의 신체정보·추천 컬럼에는 무엇을 왜 저장하는지 설명을 남긴다.
-- 번호 안내: 019가 두 개(019_fitness_difficulty_agents, 019_pet_image_gif)다. 둘 다 적용된 뒤라
--   이름을 바꿀 수 없으므로(체크섬) 두 파일은 그대로 두고, 새 마이그레이션은 020부터 이어 간다.
BEGIN;

ALTER TABLE difficulty_recommendation_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE difficulty_recommendation_runs IS
    '난이도 추천을 한 번 할 때마다 한 줄씩 남기는 기록. 가입 시·AI 추천·직접 선택 중 무엇이었는지와 세 에이전트(프로필·수행·안전)의 판단을 JSON으로 보관한다. 나이·키·몸무게 기반 판단이 들어 있어 개인정보로 다루며, 회원 삭제 시 함께 지워진다.';

COMMENT ON COLUMN profiles.age IS
    '난이도 추천에 쓰는 나이(13~100). 선택 입력이며 비어 있을 수 있다. 개인정보.';
COMMENT ON COLUMN profiles.height_cm IS
    '난이도 추천에 쓰는 키(cm, 100~250). 선택 입력이며 비어 있을 수 있다. 개인정보.';
COMMENT ON COLUMN profiles.weight_kg IS
    '난이도 추천에 쓰는 몸무게(kg, 30~300). 선택 입력이며 비어 있을 수 있다. 개인정보.';
COMMENT ON COLUMN profiles.recommended_difficulty_id IS
    '가장 최근 추천된 난이도. 난이도 정책이 삭제되면 비워진다(SET NULL).';
COMMENT ON COLUMN profiles.difficulty_reason IS
    '최근 추천의 이유 문장. 앱에 그대로 보여 준다.';
COMMENT ON COLUMN profiles.difficulty_reviewed_at IS
    '최근 난이도 추천을 검토한 시각.';

COMMIT;
