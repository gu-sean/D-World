// 시연 덤프를 한 번에 갱신한다: npm run demo:refresh
//
// 실제 DB(d_world)는 건드리지 않는다. 임시 DB에서 아래를 차례로 하고 결과만 db/dumps/에 덮어쓴 뒤 임시 DB를 지운다.
//   1) 지금 덤프 복원(날짜 맞추기 없이)  2) 최신 마이그레이션 적용  3) 빌드  4) demo:fill  5) 덤프 저장
// 마이그레이션을 추가한 사람이 이 명령을 돌려 덤프도 함께 커밋한다(덤프가 뒤처지면 단위 테스트가 실패한다).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP_DB = 'd_world_refresh_tmp';

/** 접속 주소의 DB 이름만 바꾼다 */
function withDatabase(url, name) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function baseUrl() {
  if (process.env.DEMO_DATABASE_URL) return process.env.DEMO_DATABASE_URL;
  const envFile = resolve(backendDir, '.env');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('DATABASE_URL='));
    if (line?.slice(13).trim()) return line.slice(13).trim();
  }
  return 'postgres://dworld:dworld@localhost:5432/d_world';
}

const tmpUrl = withDatabase(baseUrl(), TMP_DB);
const env = {
  ...process.env,
  DEMO_DB: TMP_DB,
  DEMO_DATABASE_URL: tmpUrl,
  DATABASE_URL: tmpUrl,
};

function run(label, args, extraEnv = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: backendDir,
    env: { ...env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(`${label} 실패 (종료 코드 ${result.status})`);
}

async function dropTmp() {
  const client = new pg.Client({
    connectionString: withDatabase(baseUrl(), 'postgres'),
  });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${TMP_DB}`);
  } finally {
    await client.end();
  }
}

try {
  run('임시 DB에 현재 덤프 복원', [
    'scripts/demo.mjs',
    '--no-start',
    '--force',
    '--no-align',
  ]);
  run('최신 마이그레이션 적용', ['scripts/migrate.mjs']);
  const npm = spawnSync('npm', ['run', 'build'], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (npm.status !== 0) throw new Error('빌드 실패');
  run('시연 데이터 채우기', ['scripts/seed-demo-fill.mjs']);
  run('덤프 저장', ['scripts/demo.mjs', '--dump']);
  console.log(
    '\n✔ 덤프를 갱신했어요. db/dumps/d_world_demo.sql 과 SHA256.txt 를 함께 커밋하세요.',
  );
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  await dropTmp().catch((e) =>
    console.error(`임시 DB 삭제 실패: ${e.message}`),
  );
}
