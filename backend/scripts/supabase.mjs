// 공유 DB(Supabase)로 백엔드를 한 번에 띄운다: npm run demo:supabase
//   준비: backend/.env.supabase (연결 정보, 팀에서 따로 받음), Node 22.9+, npm install
//   하는 일: 연결 파일 확인 → .env 없으면 생성 → DB 연결 점검 → 빌드 → 서버 실행
//   옵션: --check  연결만 점검하고 끝냄
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  explainConnectionError,
  maskUrl,
  parseEnvFile,
} from './supabase-helpers.mjs';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(backendDir, '.env');
const supabaseFile = resolve(backendDir, '.env.supabase');
const checkOnly = process.argv.includes('--check');

const log = (message) => console.log(`▶ ${message}`);
const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

// 1) 연결 정보 파일
if (!existsSync(supabaseFile)) {
  fail(
    'backend/.env.supabase 파일이 없어요.\n' +
      '  비밀번호가 든 연결 정보 파일이라 저장소에 없어요. 팀에서 따로 받아 backend 폴더에 두세요.\n' +
      '  (내용 3줄: DATABASE_URL, DATABASE_SSL=true, DATABASE_SSL_CA=certs/supabase-prod-ca-2021.crt)\n' +
      '  자세한 설명: backend/README.md "원격 DB (Supabase)"',
  );
}
const settings = parseEnvFile(readFileSync(supabaseFile, 'utf8'));
if (!settings.DATABASE_URL || settings.DATABASE_URL.includes('<')) {
  fail(
    'backend/.env.supabase 의 DATABASE_URL 이 비어 있거나 <비밀번호> 자리표시가 그대로예요.',
  );
}
log(`공유 DB: ${maskUrl(settings.DATABASE_URL)}`);

// 2) .env 가 없으면 로컬 실행용으로 만든다 (DB 주소는 .env.supabase 가 덮어씀)
if (!existsSync(envFile)) {
  log('backend/.env 생성 (.env.example 기준)');
  const secret = () => randomBytes(48).toString('base64');
  const values = {
    JWT_ACCESS_SECRET: secret(),
    ADMIN_JWT_SECRET: secret(),
    SOCIAL_DRIVER: 'mock',
    STORAGE_DRIVER: 'memory',
  };
  let text = readFileSync(resolve(backendDir, '.env.example'), 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text)
      ? text.replace(pattern, () => `${key}=${value}`)
      : `${text.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(envFile, text);
}

// 3) 연결 점검
const ca = settings.DATABASE_SSL_CA
  ? resolve(backendDir, settings.DATABASE_SSL_CA)
  : undefined;
if (ca && !existsSync(ca)) {
  fail(
    `DATABASE_SSL_CA 파일을 찾을 수 없어요: ${settings.DATABASE_SSL_CA}\n  git pull 로 certs 폴더를 받았는지 확인해 주세요.`,
  );
}
const client = new pg.Client({
  connectionString: settings.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  ssl:
    settings.DATABASE_SSL === 'true'
      ? {
          rejectUnauthorized: true,
          ...(ca ? { ca: readFileSync(ca, 'utf8') } : {}),
        }
      : undefined,
});
try {
  await client.connect();
  const { rows } = await client.query(
    "SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public')::int AS tables, (SELECT count(*) FROM users)::int AS users",
  );
  log(`DB 연결 OK (표 ${rows[0].tables}개, 회원 ${rows[0].users}명)`);
} catch (error) {
  fail(explainConnectionError(error));
} finally {
  await client.end().catch(() => {});
}
if (checkOnly) process.exit(0);

// 4) 이미 떠 있으면 새로 띄우지 않음
try {
  const response = await fetch('http://localhost:3000/health', {
    signal: AbortSignal.timeout(2000),
  });
  if (response.ok) {
    log(
      '백엔드가 이미 http://localhost:3000 에서 실행 중이에요 (새로 띄우지 않음)',
    );
    process.exit(0);
  }
} catch {
  /* 안 떠 있음 */
}

// 5) 빌드 후 실행
log('백엔드 빌드 (npm run build)');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0)
  fail('빌드에 실패했어요. (npm install 을 먼저 했는지 확인해 주세요)');

log('백엔드 실행 → http://localhost:3000  (종료: Ctrl+C)');
console.log('\n  시험 계정: 휴대폰 01099999999 / 비밀번호 1234567890\n');
// 뒤의 파일이 앞의 파일을 덮어쓴다 → DB 주소는 .env.supabase 값
const server = spawn(
  process.execPath,
  ['--env-file=.env', '--env-file=.env.supabase', 'dist/main.js'],
  { cwd: backendDir, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('exit', (code) => process.exit(code ?? 0));
