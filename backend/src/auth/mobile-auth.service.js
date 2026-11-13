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

const VERIFICATION_ID_KIND = 'phone-verification-id';
const VERIFICATION_TOKEN_KIND = 'phone-verification-token';
const SOCIAL_SIGNUP_KIND = 'social-signup';
const VERIFICATION_ID_TTL_SEC = 15 * 60;
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
 * - verificationId / verificationToken / socialSignupToken은 서명 토큰이라 새 표가 필요 없음
 * - 인증번호 저장·제한은 기존 phone_verification_challenges 그대로 사용
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

  /** A01 */
  async startPhoneVerification({ phone, purpose }) {
    const exists = await this.auth.phoneExists(phone);
    let started = null;
    if (purpose === 'reset_password') {
      // 가입 여부가 드러나지 않게 없는 번호도 같은 모양으로 응답
      if (exists) started = await this.phoneVerification.send(phone, purpose);
    } else {
      if (exists) await this.auth.sendCode(phone, purpose); // 409를 던짐
      started = await this.phoneVerification.send(phone, purpose);
    }
    return {
      verificationId: signToken(
        this.secret,
        VERIFICATION_ID_KIND,
        { phone, purpose, challengeId: started?.challengeId ?? null },
        VERIFICATION_ID_TTL_SEC,
      ),
      maskedPhoneNumber: maskPhone(phone),
      expiresAt: (
        started?.expiresAt ?? new Date(Date.now() + 3 * 60_000)
      ).toISOString(),
      resendAvailableAt: (
        started?.resendAvailableAt ?? new Date(Date.now() + 30_000)
      ).toISOString(),
    };
  }

  /** A02 */
  async confirmPhoneVerification(verificationId, code) {
    const step = readToken(this.secret, VERIFICATION_ID_KIND, verificationId);
    if (!step) throw verificationInvalid();
    const { phone, purpose, challengeId } = step;
    if (!challengeId) {
      // 가입되지 않은 번호의 재설정 요청: 항상 코드 불일치로 보인다
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'code_invalid',
        '인증번호가 올바르지 않음',
      );
    }
    const confirmedUntil = await this.phoneVerification.confirm(
      challengeId,
      phone,
      purpose,
      code,
    );
    return {
      accountStatus: purpose === 'signup' ? 'new' : 'phone_registered',
      provider: null,
      verificationToken: signToken(
        this.secret,
        VERIFICATION_TOKEN_KIND,
        { phone, purpose, challengeId },
        CONFIRMED_TTL_MINUTES * 60,
      ),
      expiresAt: confirmedUntil.toISOString(),
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
