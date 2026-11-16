/**
 * 소셜 로그인 SDK (구글 · 네이버) — 서버에 보낼 credential을 받아 온다.
 *
 *   google: ID 토큰. 서버가 서명·aud(=웹 클라이언트 ID)를 검증한다 (GOOGLE_CLIENT_IDS)
 *   naver:  access token. 서버가 네이버 프로필 API로 확인한다
 *
 * 사용자가 창을 닫으면 `null`을 돌려준다 (오류가 아니다).
 * 키는 mobile/.env: GOOGLE_WEB_CLIENT_ID, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 */
import { GoogleSignin, isCancelledResponse, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import NaverLogin from '@react-native-seoul/naver-login';

import config from '../config.js';
import AppError from '../http/AppError.js';

let googleReady = false;
let naverReady = false;

const failed = (provider, cause) =>
  new AppError('AUTH_SOCIAL_FAILED', 0, undefined, { provider, cause: cause ? String(cause) : undefined });

async function googleCredential() {
  if (!config.GOOGLE_WEB_CLIENT_ID) throw failed('google', 'GOOGLE_WEB_CLIENT_ID 없음');
  if (!googleReady) {
    // webClientId(웹 애플리케이션 유형)가 있어야 ID 토큰이 나온다. Android 클라이언트는 콘솔 등록만 필요
    GoogleSignin.configure({ webClientId: config.GOOGLE_WEB_CLIENT_ID });
    googleReady = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // 매번 계정을 고를 수 있게 이전 구글 세션은 끊는다
    await GoogleSignin.signOut().catch(() => {});
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    if (!isSuccessResponse(response) || !response.data?.idToken) throw failed('google', 'ID 토큰 없음');
    return response.data.idToken;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.code === statusCodes.SIGN_IN_CANCELLED || error?.code === statusCodes.IN_PROGRESS) return null;
    throw failed('google', error?.code ?? error?.message);
  }
}

async function naverCredential() {
  if (!config.NAVER_CLIENT_ID || !config.NAVER_CLIENT_SECRET) throw failed('naver', '네이버 키 없음');
  if (!naverReady) {
    NaverLogin.initialize({
      appName: 'D-World',
      consumerKey: config.NAVER_CLIENT_ID,
      consumerSecret: config.NAVER_CLIENT_SECRET,
      disableNaverAppAuthIOS: true,
    });
    naverReady = true;
  }
  let response;
  try {
    response = await NaverLogin.login();
  } catch (error) {
    throw failed('naver', error?.message);
  }
  if (response?.isSuccess && response.successResponse?.accessToken) {
    return response.successResponse.accessToken;
  }
  if (response?.failureResponse?.isCancel) return null;
  throw failed('naver', response?.failureResponse?.message);
}

/**
 * @param {'google'|'naver'} provider
 * @returns {Promise<string|null>} 서버에 보낼 credential, 취소하면 null
 */
export async function getSocialCredential(provider) {
  if (provider === 'google') return googleCredential();
  if (provider === 'naver') return naverCredential();
  throw failed(provider, '지원하지 않는 소셜 로그인');
}

export default { getSocialCredential };
