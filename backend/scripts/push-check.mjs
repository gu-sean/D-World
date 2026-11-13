// FCM 서비스 계정이 맞는지 실제 발송 없이 점검한다 (README "푸시(FCM) 설정" 참고)
//
// 사용: npm run push:check [-- --token <기기 FCM 토큰>]
//   .env 의 FCM_SERVICE_ACCOUNT_JSON 또는 FCM_SERVICE_ACCOUNT_PATH 를 읽어 FCM에 dryRun(전송 검증 전용) 요청을 한다.
//   --token 을 주면 그 기기 토큰까지 검증한다. 알림은 가지 않는다.
// 종료 코드: 0 = 정상, 1 = 문제 있음
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkFcm } from '../src/notices/push/fcm-check.js';

const args = process.argv.slice(2);
const tokenIndex = args.indexOf('--token');
const token = tokenIndex >= 0 ? args[tokenIndex + 1] : undefined;

const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const inline = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
const path = process.env.FCM_SERVICE_ACCOUNT_PATH?.trim();
if (!inline && !path) {
  fail(
    '서비스 계정이 설정되지 않았어요.\n' +
      '  backend/.env 에 FCM_SERVICE_ACCOUNT_PATH=<서비스 계정 JSON 파일 경로> (또는 FCM_SERVICE_ACCOUNT_JSON=<JSON 문자열>) 를 넣어 주세요.\n' +
      '  발급 방법은 backend/README.md 의 "푸시(FCM) 설정" 을 보세요.',
  );
}

let raw;
if (inline) {
  raw = inline;
} else {
  const file = resolve(path);
  if (!existsSync(file))
    fail(`FCM_SERVICE_ACCOUNT_PATH 의 파일이 없어요: ${file}`);
  raw = readFileSync(file, 'utf8');
}

let account;
try {
  account = JSON.parse(raw);
} catch {
  fail(
    '서비스 계정이 올바른 JSON이 아니에요. (Firebase 콘솔에서 받은 JSON 파일 그대로여야 해요)',
  );
}
const missing = ['project_id', 'client_email', 'private_key'].filter(
  (key) => !account[key],
);
if (account.type !== 'service_account' || missing.length > 0) {
  fail(
    `서비스 계정 JSON이 아닌 것 같아요 (type=${account.type ?? '없음'}${missing.length ? `, 빠진 항목: ${missing.join(', ')}` : ''}).\n` +
      '  Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" 으로 받은 파일을 쓰세요. (앱용 google-services.json 이 아니에요)',
  );
}

// 비밀(private_key)은 출력하지 않고, 어느 프로젝트의 계정인지만 보여 준다
console.log(`▶ 서비스 계정: ${account.client_email}`);
console.log(`▶ 프로젝트 ID : ${account.project_id}`);
if (process.env.PUSH_DRIVER !== 'fcm') {
  console.log(
    `  ! PUSH_DRIVER=${process.env.PUSH_DRIVER || '(비어 있음)'} 라서 서버는 아직 FCM을 쓰지 않아요. 점검이 통과하면 PUSH_DRIVER=fcm 으로 바꾸세요.`,
  );
}

const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
const { getMessaging } = await import('firebase-admin/messaging');
const app = initializeApp(
  { credential: cert(account) },
  `push-check-${Date.now()}`,
);

console.log(
  `▶ FCM dryRun 요청 (${token ? '입력한 기기 토큰' : '가짜 토큰'}) …`,
);
const result = await checkFcm({ messaging: getMessaging(app), token });
console.log(
  `${result.ok ? '✔' : '✖'} ${result.message}${result.code ? `  [${result.code}]` : ''}`,
);
// 네트워크 연결을 정리하고 종료 코드만 설정한다. 요청 직후 process.exit()를 부르면
// Windows의 Node에서 비정상 종료(코드 127)가 날 수 있다.
await deleteApp(app);
process.exitCode = result.ok ? 0 : 1;
