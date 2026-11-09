/**
 * 계정 가짜 응답 (A01~A16). 07 §2 모양.
 * 개발 계정은 12 §9의 `01000000001` / `devuser1234` / 닉네임 `개발유저`.
 */

export const DEV_PHONE = '01000000001';
export const DEV_PASSWORD = 'devuser1234';
export const DEV_OTP = '000000';

export const profile = { id: 'user-dev-0001', nickname: '개발유저' };

/** `Session` (07 §2) */
export function session(now = Date.now()) {
  return {
    profile,
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
    },
  };
}

/** `PhoneVerificationStarted` */
export function phoneVerificationStarted(now = Date.now()) {
  return {
    verificationId: 'verification-0001',
    maskedPhoneNumber: '010-****-0001',
    expiresAt: new Date(now + 3 * 60 * 1000).toISOString(),
    resendAvailableAt: new Date(now + 30 * 1000).toISOString(),
  };
}

/** `PhoneVerificationConfirmed` */
export function phoneVerificationConfirmed(accountStatus, now = Date.now()) {
  const withToken = accountStatus === 'new' || accountStatus === 'phone_registered';
  return {
    accountStatus,
    provider: null,
    verificationToken: withToken ? 'mock-verification-token' : null,
    expiresAt: withToken ? new Date(now + 10 * 60 * 1000).toISOString() : null,
  };
}

/** A04 `PolicyDocument[]` — terms·privacy·marketing 순 */
export const policyDocuments = [
  {
    id: 'policy-terms-1', documentType: 'terms', version: '1.0', isRequired: true,
    body: '서비스 이용약관 전문(개발용).', effectiveAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'policy-privacy-1', documentType: 'privacy', version: '1.0', isRequired: true,
    body: '개인정보 처리방침 전문(개발용).', effectiveAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'policy-marketing-1', documentType: 'marketing', version: '1.0', isRequired: false,
    body: '마케팅 정보 수신 동의 전문(개발용).', effectiveAt: '2026-01-01T00:00:00.000Z',
  },
];

/** A11 `Me` */
export function me(overrides = {}) {
  return {
    id: profile.id,
    nickname: profile.nickname,
    phoneLinked: true,
    providers: [],
    levelNo: 3,
    totalXp: 1240,
    nextLevelXp: 1500,
    availablePoints: 1250,
    streakDays: 5,
    notificationEnabled: true,
    representativePet: { id: 'pet-0001', nickname: '꾸준냥이', stageCode: 'baby', imageUrl: null },
    representativeBadge: { achievementId: 'ach-0001', title: '꾸준한 일주일', rarity: 'common', badgeImageUrl: null },
    restriction: null,
    pendingConsents: [],
    ...overrides,
  };
}

export default {
  DEV_PHONE,
  DEV_PASSWORD,
  DEV_OTP,
  profile,
  session,
  phoneVerificationStarted,
  phoneVerificationConfirmed,
  policyDocuments,
  me,
};
