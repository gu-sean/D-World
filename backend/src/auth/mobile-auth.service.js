import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionKind } from '../common/auth/auth.constants.js';
import { SessionsService } from '../common/auth/sessions.service.js';
import { readToken, signToken } from '../common/crypto/signed-token.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { ConsentService } from '../accounts/consent.service.js';
import { AuthService } from './auth.service.js';
import {
  CONFIRMED_TTL_MINUTES,
  PhoneVerificationService,
} from './phone-verification.service.js';
import { SocialVerifierService } from './social/social-verifier.service.js';

const VERIFICATION_TOKEN_KIND = 'phone-verification-token';
const SOCIAL_SIGNUP_KIND = 'social-signup';
const SOCIAL_SIGNUP_TTL_SEC = 10 * 60;
const REQUIRED_TYPES = ['terms', 'privacy'];
// A04 응답 순서 (모바일 authApi.js: terms·privacy·marketing 순), 목록에 없는 종류는 뒤로
const POLICY_ORDER = ['terms', 'privacy', 'marketing'];
const policyRank = (type) => {
  const index = POLICY_ORDER.indexOf(type);
  return index === -1 ? POLICY_ORDER.length : index;
};

const verificationInvalid = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'verification_token_invalid',
    '인증 시간이 지났어요',
  );

/** 마스킹된 번호 "010-****-0001" */
export function maskPhone(e164) {
  const national = `0${e164.slice(3)}`;
  return `${national.slice(0, 3)}-****-${national.slice(-4)}`;
}

/**
 * 모바일 클라이언트 계정 API (팀 문서 08 A01~A10, 07 §2)
 * - verificationToken / socialSignupToken은 서명 토큰이라 새 표가 필요 없음
 * - 휴대폰 인증번호 단계는 없음: A01이 바로 확인된 challenge(phone_verification_challenges)를 만든다
 */
@Injectable()
@Dependencies(
  DatabaseService,
  ConfigService,
  AuthService,
  PhoneVerificationService,
  SessionsService,
  SocialVerifierService,
  ConsentService,
)
export class MobileAuthService {
  constructor(
    database,
    config,
    auth,
    phoneVerification,
    sessions,
    socialVerifier,
    consents,
  ) {
    this.database = database;
    this.config = config;
    this.auth = auth;
    this.phoneVerification = phoneVerification;
    this.sessions = sessions;
    this.socialVerifier = socialVerifier;
    this.consents = consents;
  }

  get secret() {
    return this.config.get('JWT_ACCESS_SECRET');
  }

  /** 07 Session: { profile, tokens } */
  async toSession(result) {
    const { rows } = await this.database.query(
      'SELECT nickname FROM profiles WHERE user_id = $1',
      [result.userId],
    );
    return {
      profile: { id: result.userId, nickname: rows[0]?.nickname ?? null },
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
      },
    };
  }

  /**
   * A01: 인증번호 없이 번호만 받고 바로 확인된 결과를 돌려준다 (예전 A02 응답 모양)
   *   new               가입 가능한 번호 → verificationToken 발급
   *   phone_registered  가입이면 기존 계정 안내 / 재설정이면 verificationToken 발급
   *   not_registered    재설정할 계정 없음
   *
   * 비밀번호 재설정(reset_password)은 막아 둔다: 인증번호가 없으면 번호만 알아도 남의 비밀번호를
   * 바꿀 수 있기 때문이다. 앱도 재설정 버튼을 숨긴다 (mobile config.PASSWORD_RESET_ENABLED).
   * 인증번호 기반 재설정(AuthController auth/phone/codes → auth/password/reset)은 그대로다.
   */
  async startPhoneVerification({ phone, purpose }) {
    if (purpose === 'reset_password') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'password_reset_disabled',
        '지금은 비밀번호 재설정을 쓸 수 없어요',
      );
    }
    const exists = await this.auth.phoneExists(phone);
    const base = { maskedPhoneNumber: maskPhone(phone), provider: null };
    if (purpose === 'signup' && exists) {
      return { ...base, accountStatus: 'phone_registered' };
    }
    if (purpose === 'reset_password' && !exists) {
      return { ...base, accountStatus: 'not_registered' };
    }
    const { challengeId, expiresAt } =
      await this.phoneVerification.issueConfirmed(phone, purpose);
    return {
      ...base,
      accountStatus: purpose === 'signup' ? 'new' : 'phone_registered',
      verificationToken: signToken(
        this.secret,
        VERIFICATION_TOKEN_KIND,
        { phone, purpose, challengeId },
        CONFIRMED_TTL_MINUTES * 60,
      ),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** A04: 필수 여부(isRequired)를 붙인 현재 약관 */
  async currentPolicies() {
    const versions = await this.consents.currentVersions();
    return [...versions]
      .sort((a, b) => policyRank(a.document_type) - policyRank(b.document_type))
      .map((v) => ({
        id: v.id,
        documentType: v.document_type,
        version: v.version,
        isRequired: REQUIRED_TYPES.includes(v.document_type),
        body: v.body,
        effectiveAt: v.effective_at,
      }));
  }

  /** A05: 휴대폰 가입(verificationToken) 또는 소셜 가입(socialSignupToken) */
  async signup(input) {
    if (input.socialSignupToken) {
      const social = readToken(
        this.secret,
        SOCIAL_SIGNUP_KIND,
        input.socialSignupToken,
      );
      if (!social) throw verificationInvalid();
      const result = await this.auth.completeSocialSignup({
        provider: social.provider,
        identity: { subject: social.subject, email: social.email },
        nickname: input.nickname,
        consents: input.consents,
      });
      return this.toSession(result);
    }
    const step = readToken(
      this.secret,
      VERIFICATION_TOKEN_KIND,
      input.verificationToken,
    );
    if (!step || step.purpose !== 'signup' || !input.password) {
      throw verificationInvalid();
    }
    const result = await this.auth.completePhoneSignup({
      phone: step.phone,
      challengeId: step.challengeId,
      password: input.password,
      nickname: input.nickname,
      consents: input.consents,
    });
    return this.toSession(result);
  }

  /** A06 */
  async login({ phone, password }) {
    return this.toSession(await this.auth.loginPhone({ phone, password }));
  }

  /** A07: 가입된 소셜이면 Session, 아니면 SocialSignupRequired */
  async socialLogin(provider, credential) {
    const identity = await this.socialVerifier.verify(provider, credential);
    const result = await this.auth.loginWithIdentity(provider, identity);
    if (result) return this.toSession(result);
    return {
      signupRequired: true,
      provider,
      email: identity.email,
      socialSignupToken: signToken(
        this.secret,
        SOCIAL_SIGNUP_KIND,
        { provider, subject: identity.subject, email: identity.email },
        SOCIAL_SIGNUP_TTL_SEC,
      ),
    };
  }

  /** A08 */
  async resetPassword({ verificationToken, newPassword }) {
    const step = readToken(
      this.secret,
      VERIFICATION_TOKEN_KIND,
      verificationToken,
    );
    if (!step || step.purpose !== 'reset_password') {
      throw verificationInvalid();
    }
    await this.auth.completePasswordReset({
      phone: step.phone,
      challengeId: step.challengeId,
      newPassword,
    });
  }

  /** A09 */
  async refresh(refreshToken) {
    return this.toSession(await this.auth.refresh({ refreshToken }));
  }

  /** A10: 토큰이 없거나 이미 폐기여도 성공 */
  logout(refreshToken) {
    return this.sessions.revokeByRefreshToken(
      this.database,
      SessionKind.User,
      refreshToken,
    );
  }
}
