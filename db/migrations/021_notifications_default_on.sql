-- 회원 알림(푸시) 기본값을 켜짐으로 바꾸고, 지금 꺼져 있는 회원도 켠다
--   인증 결과·공지 푸시는 profiles.notification_enabled = true 인 회원에게만 간다.
--   기본값이 false라 설정에서 직접 켜지 않으면 푸시가 오지 않았는데, 앱은 로그인 직후 알림 권한을 묻고
--   인증 대기 화면에서 "결과는 알림으로도 알려 드려요"라고 안내해 왔다.
--   휴대폰 알림 권한을 거절한 기기에는 토큰이 등록되지 않으므로 이 값을 켜도 푸시는 가지 않는다.
--   회원은 앱의 설정 → "알림 받기"에서 언제든 끌 수 있다.
BEGIN;

ALTER TABLE profiles ALTER COLUMN notification_enabled SET DEFAULT true;

UPDATE profiles SET notification_enabled = true WHERE notification_enabled = false;

COMMIT;
