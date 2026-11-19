// 앱(모바일)과 서버가 실제로 쓰는 보상·성장 규칙. 서버 코드의 상수와 같은 값이다:
//   backend/src/points/points.service.js       DAILY_MISSION_POINT_LIMIT
//   backend/src/experience-pets/pet-xp.service.js  MISSION_PET_XP, FEED_XP, HATCH_MISSIONS, ADULT_XP
// 값이 서버에 고정돼 있어 관리자 화면은 보여 주기만 한다(새 펫 종류의 단계 XP도 이 값으로 채운다).
export const GAME_RULES = {
  missionPoints: 30, // 세부 미션 1회 포인트
  missionPetXp: 30, // 세부 미션 1회 펫 XP
  dailyPointLimit: 120, // 하루 포인트 한도 (30 P × 4개)
  dailyPetXp: 30, // 하루 펫 XP: 하루 첫 미션 1회만
  hatchMissions: 3, // 알 → 아기: 알을 고른 뒤 완료한 세부 미션 수
  babyXp: 90, // 알 → 아기에 해당하는 XP (30 × 3)
  adultXp: 450, // 아기 → 성체: 먹인 경험치
  feedXp: 10, // "경험치 주기" 한 번에 먹이는 양
};

/** 펫 종류 단계별 필요 누적 XP (1단계 알, 2단계 아기, 3단계 성체) */
export const STAGE_MIN_XP = { 1: 0, 2: GAME_RULES.babyXp, 3: GAME_RULES.adultXp };
