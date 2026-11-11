// 인증번호를 발송하는 요청: 앱 A01, 기존 가입·로그인용, 내 번호 변경용
const SMS_SEND_PATH =
  /\/(auth\/phone-verifications|auth\/phone\/codes|me\/phone\/codes)$/;

/** 문자 발송 비용을 일으키는 요청인지(IP당 시간당 제한 'sms' 대상 판별) */
export const isSmsSendRequest = (request) =>
  request.method === 'POST' && SMS_SEND_PATH.test(request.path ?? '');
