import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppException } from '../../common/errors/app-exception.js';

export const SOCIAL_PROVIDERS = ['apple', 'google', 'naver'];

const APPLE_ISSUER = 'https://appleid.apple.com';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const NAVER_TIMEOUT_MS = 5_000;

const invalidToken = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'invalid_social_token',
    '소셜 로그인 토큰이 올바르지 않음',
  );

const unavailable = (provider) =>
  new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'social_unavailable',
    `${provider} 로그인이 설정되지 않음`,
  );

/**
 * 제공자 토큰 검증 후 { subject, email } 반환
 * Apple·Google: ID 토큰 서명(JWKS)·iss·aud·exp 검증, 네이버: access token으로 프로필 조회
 * email은 참고용이며 계정 병합 키로 쓰지 않음
 */
@Injectable()
@Dependencies(ConfigService)
export class SocialVerifierService {
  constructor(config) {
    this.config = config;
    this.jwks = {};
  }

  jwksFor(url) {
    this.jwks[url] ??= createRemoteJWKSet(new URL(url));
    return this.jwks[url];
  }

  verify(provider, token) {
    if (this.config.get('SOCIAL_DRIVER') === 'mock')
      return this.verifyMock(token);
    switch (provider) {
      case 'apple':
        return this.verifyApple(token);
      case 'google':
        return this.verifyGoogle(token);
      case 'naver':
        return this.verifyNaver(token);
      default:
        throw invalidToken();
    }
  }

  /** 개발 전용: `mock:{subject}:{email}` 형식이면 검증 없이 통과 */
  verifyMock(token) {
    const match = /^mock:([^:\s]{1,100}):?(\S*)$/.exec(token);
    if (!match) throw invalidToken();
    return { subject: match[1], email: match[2] || null };
  }

  async verifyIdToken(token, { jwksUrl, issuer, audience }) {
    try {
      const { payload } = await jwtVerify(token, this.jwksFor(jwksUrl), {
        issuer,
        audience,
      });
      if (!payload.sub) throw new Error('sub 없음');
      return { subject: payload.sub, email: payload.email ?? null };
    } catch {
      throw invalidToken();
    }
  }

  verifyApple(token) {
    const audience = this.config.get('APPLE_CLIENT_ID');
    if (!audience) throw unavailable('apple');
    return this.verifyIdToken(token, {
      jwksUrl: `${APPLE_ISSUER}/auth/keys`,
      issuer: APPLE_ISSUER,
      audience,
    });
  }

  verifyGoogle(token) {
    const audience = (this.config.get('GOOGLE_CLIENT_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (audience.length === 0) throw unavailable('google');
    return this.verifyIdToken(token, {
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      issuer: GOOGLE_ISSUERS,
      audience,
    });
  }

  async verifyNaver(token) {
    let body;
    try {
      const response = await fetch(this.config.get('NAVER_PROFILE_URL'), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(NAVER_TIMEOUT_MS),
      });
      if (!response.ok) throw invalidToken();
      body = await response.json();
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw invalidToken();
    }
    const id = body?.response?.id;
    if (body?.resultcode !== '00' || typeof id !== 'string' || !id) {
      throw invalidToken();
    }
    return { subject: id, email: body.response.email ?? null };
  }
}
