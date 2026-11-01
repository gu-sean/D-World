-- users 참조 FK 중 인덱스가 없던 곳에 추가, 없으면 탈퇴 때 전체 스캔
BEGIN;

CREATE INDEX ai_plan_proposals_user_idx ON ai_plan_proposals (user_id);
CREATE INDEX challenge_participations_user_idx ON challenge_participations (user_id);
CREATE INDEX challenge_publication_reviews_requester_idx
    ON challenge_publication_reviews (requested_by_user_id)
    WHERE requested_by_user_id IS NOT NULL;
CREATE INDEX challenge_rule_events_requester_idx
    ON challenge_rule_events (requested_by_user_id)
    WHERE requested_by_user_id IS NOT NULL;
CREATE INDEX challenges_creator_idx
    ON challenges (created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX experience_transactions_user_idx
    ON experience_transactions (user_id, id);
CREATE INDEX mission_publication_reviews_requester_idx
    ON mission_publication_reviews (requested_by_user_id)
    WHERE requested_by_user_id IS NOT NULL;

COMMIT;
