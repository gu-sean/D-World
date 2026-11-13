-- 표 설명 추가 (구조·데이터 변경 없음)
BEGIN;

COMMENT ON TABLE challenge_score_snapshots IS
    '현재 사용하지 않음: 순위는 진행 중에는 challenge_live_rankings 뷰, 정산 확정 후에는 challenge_final_rankings 표가 담당한다. 앱 코드가 읽거나 쓰지 않으며 항상 비어 있는 것이 정상이다.';

COMMIT;
