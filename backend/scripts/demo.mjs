// 시연용 DB 덤프로 로컬 테스트 환경을 한 번에 만든다 (db/dumps/README.md 참고)
//
// 사용 (backend 폴더에서, 처음 한 번은 npm install 먼저)
//   npm run demo           DB 준비 → 덤프 복원 → backend/.env 준비 → 빌드 → 서버 실행
//   npm run demo:reset     위와 같되, 이미 복원돼 있어도 덤프로 DB를 다시 덮어씀
//   npm run demo:dump      지금 DB 내용을 덤프 파일로 다시 저장 (db/dumps/d_world_demo.sql, SHA256.txt)
//
// 환경은 자동으로 고른다 (강제: --docker / --local)
//   Docker 환경   docker compose의 postgres 컨테이너를 띄워 쓴다
//   로컬 환경     Docker가 없으면 PC에 설치된 PostgreSQL을 psql로 쓴다 (psql·pg_dump 필요)
//
// 옵션: --force(덮어쓰기) --no-start(서버는 띄우지 않음) --skip-verify(덤프 해시 검증 생략) --no-align(복원 후 날짜 맞추기 생략) --dump [--out 경로]
// 환경 변수
//   DEMO_DB            (Docker) 대상 DB 이름, 기본 d_world
//   DEMO_DATABASE_URL  (로컬) 접속 주소, 기본은 backend/.env의 DATABASE_URL, 없으면 postgres://dworld:dworld@localhost:5432/d_world
//   DEMO_ADMIN_URL     (로컬) DB·계정(dworld)이 없을 때 만들어 줄 관리자 접속 주소, 예: postgres://postgres:비밀번호@localhost:5432/postgres
//   PG_BIN             (로컬) psql·pg_dump가 있는 폴더 (PATH에 없을 때)
//
// 안전장치: 대상 DB에 시연 계정이 없는데 다른 사용자 데이터가 있으면 덮어쓰지 않고 멈춘다(--force로만 덮어씀).
// 외부 패키지 없이 Node 내장 모듈만 쓴다 (Windows·macOS·Linux 공통).
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { normalizeLineEndings, verifyDump } from './demo-dump-verify.mjs';
import {
  alignDatesSql,
  alignSeedChallengeSql,
  daysBetween,
  DUMP_ANCHOR_DATE,
  kstToday,
} from './demo-align-dates.mjs';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(backendDir, '..');
const defaultDump = resolve(repoRoot, 'db/dumps/d_world_demo.sql');
const envFile = resolve(backendDir, '.env');

const DOCKER_DB = process.env.DEMO_DB ?? 'd_world';
const DB_USER = 'dworld';
const DB_PASSWORD = 'dworld';
const DEMO_PHONE = '+821099999999';
// 덤프에서 데이터를 뺀 표(로그인 세션·인증번호·멱등 키·푸시 기기): 구조만 남기고 비밀·일회성 값은 담지 않음
const EXCLUDED_DATA = [
  'auth_sessions',
  'admin_sessions',
  'phone_verification_challenges',
  'admin_idempotency_keys',
  'user_idempotency_keys',
  'push_devices',
];

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const force = has('--force');

const log = (message) => console.log(`▶ ${message}`);
const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};
const maskUrl = (url) => url.replace(/(:\/\/[^:/@]+:)[^@]*@/, '$1****@');

/**
 * 덤프를 psql에 넣을 형태로 만든다.
 * 첫머리/끝의 \restrict·\unrestrict는 pg_dump 최신 패치가 넣는 보안 토큰 줄인데,
 * 오래된 psql은 이 명령을 몰라 실패하므로 지운다(내용에는 영향 없음).
 */
function prepareDump() {
  if (!existsSync(defaultDump)) {
    fail(
      '덤프 파일이 없어요: db/dumps/d_world_demo.sql\n  develop을 최신으로 받았는지 확인해 주세요 (git pull).',
    );
  }
  const raw = readFileSync(defaultDump);
  if (!has('--skip-verify')) {
    const hashFile = resolve(dirname(defaultDump), 'SHA256.txt');
    const checked = verifyDump(
      raw,
      existsSync(hashFile) ? readFileSync(hashFile, 'utf8') : null,
    );
    if (checked.reason === 'no-hash-file') {
      log('! SHA256.txt가 없어 덤프 검증을 건너뛰어요');
    } else if (!checked.ok) {
      fail(
        '덤프 파일이 SHA256.txt와 달라요 (' +
          (checked.reason === 'bad-hash-file'
            ? 'SHA256.txt 형식 오류'
            : '내용 불일치') +
          ').\n  git pull로 최신을 다시 받거나, 의도적으로 바꾼 덤프라면 npm run demo:dump로 해시를 갱신하세요.\n  (확인 없이 진행하려면 --skip-verify)',
      );
    } else if (checked.lineEndingsFixed) {
      log(
        '! 덤프의 줄바꿈이 CRLF로 바뀌어 있어 LF로 되돌려 사용해요 (db/dumps/.gitattributes 확인)',
      );
    }
  }
  const text = normalizeLineEndings(raw).toString('utf8');
  return Buffer.from(
    text
      .split('\n')
      .filter((line) => !/^\\(un)?restrict(\s|$)/.test(line))
      .join('\n'),
    'utf8',
  );
}

// ───────────────────────── Docker 환경 ─────────────────────────

function composeRun(composeArgs, options = {}) {
  return spawnSync(
    'docker',
    ['compose', '-f', resolve(repoRoot, 'docker-compose.yml'), ...composeArgs],
    { cwd: repoRoot, maxBuffer: 512 * 1024 * 1024, ...options },
  );
}

function dockerPsql(database, { sql, input } = {}) {
  const base = [
    'exec',
    '-T',
    '-e',
    `PGUSER=${DB_USER}`,
    '-e',
    `PGPASSWORD=${DB_PASSWORD}`,
    'postgres',
    'psql',
    '-d',
    database,
  ];
  if (sql !== undefined) {
    const result = composeRun([...base, '-tAc', sql], { encoding: 'utf8' });
    return {
      status: result.status,
      out: (result.stdout ?? '').trim(),
      err: result.stderr ?? '',
    };
  }
  const result = composeRun(
    [...base, '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    {
      input,
    },
  );
  return {
    status: result.status,
    out: '',
    err: (result.stderr ?? '').toString(),
  };
}

/** Docker가 설치돼 있고 데몬이 떠 있는가 */
function dockerReady() {
  const probe = spawnSync('docker', ['info'], {
    encoding: 'utf8',
    timeout: 20000,
  });
  return !probe.error && probe.status === 0;
}

const dockerDriver = {
  name: 'Docker',
  database: DOCKER_DB,
  databaseUrl: `postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DOCKER_DB}`,
  async prepare() {
    log('DB 컨테이너(postgres) 기동 [Docker 환경]');
    const up = composeRun(['up', '-d', 'postgres'], { encoding: 'utf8' });
    if (up.status !== 0) {
      fail(`postgres 컨테이너를 띄우지 못했어요.\n${up.stderr ?? ''}`);
    }
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const ready = composeRun(
        [
          'exec',
          '-T',
          'postgres',
          'pg_isready',
          '-U',
          DB_USER,
          '-d',
          'postgres',
        ],
        { encoding: 'utf8' },
      );
      if (ready.status === 0) break;
      if (attempt === 59) {
        fail(
          'postgres가 60초 안에 준비되지 않았어요. docker compose logs postgres 를 확인해 주세요.',
        );
      }
      await sleep(1000);
    }
    const exists = dockerPsql('postgres', {
      sql: `SELECT 1 FROM pg_database WHERE datname = '${DOCKER_DB}'`,
    });
    if (exists.out !== '1') {
      log(`DB "${DOCKER_DB}" 생성`);
      const created = dockerPsql('postgres', {
        sql: `CREATE DATABASE "${DOCKER_DB}"`,
      });
      if (created.status !== 0) fail(`DB를 만들지 못했어요.\n${created.err}`);
    }
  },
  query: (sql) => dockerPsql(DOCKER_DB, { sql }),
  restore: (input) => dockerPsql(DOCKER_DB, { input }),
  dump() {
    const result = composeRun([
      'exec',
      '-T',
      '-e',
      `PGUSER=${DB_USER}`,
      '-e',
      `PGPASSWORD=${DB_PASSWORD}`,
      'postgres',
      'pg_dump',
      '-d',
      DOCKER_DB,
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      ...EXCLUDED_DATA.map((table) => `--exclude-table-data=${table}`),
    ]);
    return {
      status: result.status,
      stdout: result.stdout,
      err: (result.stderr ?? '').toString(),
    };
  },
};

// ─────────────────── 로컬 환경 (Docker 없이 설치된 PostgreSQL) ───────────────────

/** PATH, PG_BIN, 흔한 설치 위치에서 psql·pg_dump 같은 실행 파일을 찾는다 */
function findPgBinary(name) {
  const file = process.platform === 'win32' ? `${name}.exe` : name;
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN);
  if (process.platform === 'win32') {
    for (const base of [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
    ]) {
      if (!base) continue;
      const root = join(base, 'PostgreSQL');
      if (existsSync(root)) {
        for (const version of readdirSync(root).sort().reverse()) {
          candidates.push(join(root, version, 'bin'));
        }
      }
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/opt/postgresql@16/bin',
      '/opt/homebrew/bin',
      '/usr/local/opt/postgresql@16/bin',
      '/usr/local/bin',
      '/Applications/Postgres.app/Contents/Versions/latest/bin',
    );
  } else if (existsSync('/usr/lib/postgresql')) {
    for (const version of readdirSync('/usr/lib/postgresql').sort().reverse()) {
      candidates.push(join('/usr/lib/postgresql', version, 'bin'));
    }
  }
  const onPath = spawnSync(name, ['--version'], { encoding: 'utf8' });
  if (!onPath.error && onPath.status === 0) return name;
  for (const dir of candidates) {
    const full = join(dir, file);
    if (existsSync(full)) return full;
  }
  return null;
}

/** 로컬 모드의 접속 주소: 환경 변수 → backend/.env → 기본값 */
function localDatabaseUrl() {
  if (process.env.DEMO_DATABASE_URL) return process.env.DEMO_DATABASE_URL;
  if (existsSync(envFile)) {
    const found = /^DATABASE_URL=(.+)$/m.exec(readFileSync(envFile, 'utf8'));
    if (found) return found[1].trim();
  }
  return `postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/d_world`;
}

const withDatabase = (url, database) => {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next.toString();
};

function createLocalDriver() {
  const psqlPath = findPgBinary('psql');
  if (!psqlPath) {
    fail(
      'Docker도 psql도 찾을 수 없어요. 둘 중 하나를 준비해 주세요.\n' +
        '  A) Docker Desktop 설치 후 실행            → npm run demo\n' +
        '  B) PostgreSQL 16 설치(psql 포함)           → npm run demo\n' +
        '     Windows: https://www.postgresql.org/download/windows/  macOS: brew install postgresql@16\n' +
        '     Linux: sudo apt install postgresql-client-16 (서버도 필요하면 postgresql-16)\n' +
        '  psql이 PATH에 없으면 PG_BIN=<psql이 있는 폴더> 를 지정하세요.',
    );
  }
  const url = localDatabaseUrl();
  let database;
  try {
    database = decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    fail(`접속 주소를 읽을 수 없어요: ${url}`);
  }

  const run = (target, extra, options = {}) =>
    spawnSync(psqlPath, [target, ...extra], {
      maxBuffer: 512 * 1024 * 1024,
      ...options,
    });
  const query = (target, sql) => {
    const result = run(target, ['-tAc', sql], { encoding: 'utf8' });
    return {
      status: result.status ?? 1,
      out: (result.stdout ?? '').trim(),
      err: `${result.stderr ?? ''}${result.error?.message ?? ''}`,
    };
  };

  return {
    name: '로컬 PostgreSQL',
    database,
    databaseUrl: url,
    async prepare() {
      log(`로컬 PostgreSQL 연결 확인 [로컬 환경] ${maskUrl(url)}`);
      const probe = query(url, 'SELECT 1');
      if (probe.out === '1') return;

      const adminUrl = process.env.DEMO_ADMIN_URL;
      const missingDb = /database ".*" does not exist/.test(probe.err);
      const missingRole =
        /role ".*" does not exist/.test(probe.err) ||
        /password authentication failed/.test(probe.err);
      const unreachable =
        /could not connect|Connection refused|timeout expired/i.test(probe.err);
      if (unreachable) {
        fail(
          `PostgreSQL 서버에 연결할 수 없어요 (${maskUrl(url)}).\n` +
            '  PostgreSQL 서비스가 켜져 있는지, 주소·포트가 맞는지 확인해 주세요.',
        );
      }
      if (!missingDb && !missingRole) {
        fail(`PostgreSQL에 접속하지 못했어요 (${maskUrl(url)}).\n${probe.err}`);
      }

      const user = decodeURIComponent(new URL(url).username);
      const password = decodeURIComponent(new URL(url).password);
      const admin =
        adminUrl ?? (missingDb ? withDatabase(url, 'postgres') : null);
      if (!admin) {
        fail(
          `접속 계정 "${user}" 또는 DB "${database}"가 없어요. 아래를 PostgreSQL 관리자(보통 postgres)로 한 번 실행한 뒤 다시 하세요.\n` +
            `  psql -U postgres -c "CREATE ROLE ${user} LOGIN PASSWORD '${password}' CREATEDB"\n` +
            `  psql -U postgres -c "CREATE DATABASE ${database} OWNER ${user}"\n` +
            '  (또는 관리자 접속 주소를 DEMO_ADMIN_URL 로 주면 스크립트가 만들어 줘요)',
        );
      }
      log(`계정·DB 생성 (관리자 접속: ${maskUrl(admin)})`);
      if (missingRole) {
        const exists = query(
          admin,
          `SELECT 1 FROM pg_roles WHERE rolname = '${user}'`,
        );
        if (exists.out !== '1') {
          const role = query(
            admin,
            `CREATE ROLE "${user}" LOGIN PASSWORD '${password.replace(/'/g, "''")}' CREATEDB`,
          );
          if (role.status !== 0) fail(`계정을 만들지 못했어요.\n${role.err}`);
        }
      }
      const hasDb = query(
        admin,
        `SELECT 1 FROM pg_database WHERE datname = '${database}'`,
      );
      if (hasDb.out !== '1') {
        const created = query(
          admin,
          `CREATE DATABASE "${database}" OWNER "${user}"`,
        );
        if (created.status !== 0) fail(`DB를 만들지 못했어요.\n${created.err}`);
      }
      if (query(url, 'SELECT 1').out !== '1') {
        fail(
          '계정·DB를 만들었지만 아직 접속되지 않아요. 비밀번호와 pg_hba.conf 설정을 확인해 주세요.',
        );
      }
    },
    query: (sql) => query(url, sql),
    restore(input) {
      const result = run(url, ['-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], {
        input,
      });
      return {
        status: result.status ?? 1,
        out: '',
        err: `${(result.stderr ?? '').toString()}${result.error?.message ?? ''}`,
      };
    },
    dump() {
      const pgDump = findPgBinary('pg_dump');
      if (!pgDump)
        return {
          status: 1,
          stdout: null,
          err: 'pg_dump를 찾을 수 없어요. PG_BIN 을 지정하세요.',
        };
      const result = spawnSync(
        pgDump,
        [
          url,
          '--no-owner',
          '--no-privileges',
          '--clean',
          '--if-exists',
          ...EXCLUDED_DATA.map((table) => `--exclude-table-data=${table}`),
        ],
        { maxBuffer: 512 * 1024 * 1024 },
      );
      return {
        status: result.status ?? 1,
        stdout: result.stdout,
        err: (result.stderr ?? '').toString(),
      };
    },
  };
}

// ─────────────────────────── 공통 ───────────────────────────

function chooseDriver() {
  if (has('--local')) return createLocalDriver();
  if (has('--docker')) {
    if (!dockerReady()) {
      fail(
        'Docker를 쓸 수 없어요. Docker Desktop이 실행 중인지 확인하거나 --local 로 실행하세요.',
      );
    }
    return dockerDriver;
  }
  if (dockerReady()) return dockerDriver;
  log('Docker를 쓸 수 없어 로컬 PostgreSQL(psql)로 진행해요');
  return createLocalDriver();
}

function restoreDump(driver) {
  const prepared = prepareDump();
  const hasTable =
    driver.query("SELECT to_regclass('public.phone_credentials') IS NOT NULL")
      .out === 't';
  const demoCount = hasTable
    ? Number(
        driver.query(
          `SELECT count(*) FROM phone_credentials WHERE phone_e164 = '${DEMO_PHONE}'`,
        ).out,
      )
    : 0;
  const userCount = hasTable
    ? Number(driver.query('SELECT count(*) FROM users').out)
    : 0;

  if (demoCount > 0 && !force) {
    log(
      '시연 데이터가 이미 들어 있어요 (건너뜀, 다시 덮어쓰려면 npm run demo:reset)',
    );
    return;
  }
  if (userCount > 0 && demoCount === 0 && !force) {
    fail(
      `"${driver.database}" DB에 시연 계정이 아닌 다른 사용자 ${userCount}명의 데이터가 있어요.\n` +
        '  복원하면 이 DB의 기존 데이터가 모두 지워져요. 덮어써도 되면 npm run demo:reset 으로 다시 실행하세요.',
    );
  }

  log(`시연 덤프 복원 → ${driver.database} (db/dumps/d_world_demo.sql)`);
  const restored = driver.restore(prepared);
  if (restored.status !== 0) fail(`덤프 복원에 실패했어요.\n${restored.err}`);

  // 덤프 갱신(demo:refresh)은 날짜를 옮기지 않은 원본 상태가 필요하다
  if (has('--no-align')) return;

  // 시드 공개 챌린지는 항상 "곧 시작" 상태로 맞춘다
  const seeded = driver.restore(alignSeedChallengeSql());
  if (seeded.status !== 0)
    fail(`시드 챌린지 날짜를 맞추지 못했어요.
${seeded.err}`);

  // 덤프를 만든 날과 다른 날 복원하면 시험 계정의 날짜를 오늘로 맞춘다
  const delta = daysBetween(DUMP_ANCHOR_DATE, kstToday());
  if (delta !== 0) {
    const aligned = driver.restore(alignDatesSql(DEMO_PHONE, delta));
    if (aligned.status !== 0) {
      fail(`시험 계정 날짜를 오늘로 맞추지 못했어요.\n${aligned.err}`);
    }
    log(
      `시험 계정의 미션·기록 날짜를 ${delta}일 옮겼어요 (덤프 기준일 ${DUMP_ANCHOR_DATE})`,
    );
  }
}

/** backend/.env가 없으면 .env.example에서 만들고 로컬 실행에 필요한 값만 채운다. 있으면 건드리지 않는다 */
function prepareEnv(driver) {
  if (existsSync(envFile)) {
    const current = readFileSync(envFile, 'utf8');
    const url = /^DATABASE_URL=(.*)$/m.exec(current)?.[1] ?? '';
    if (!url.includes(`/${driver.database}`)) {
      console.log(
        `  ! 기존 backend/.env의 DATABASE_URL이 "${driver.database}" DB를 가리키지 않아요. 확인해 주세요: ${maskUrl(url)}`,
      );
    }
    log('backend/.env 가 이미 있어 그대로 사용');
    return;
  }
  log('backend/.env 생성 (.env.example 기준, 로컬 시연용 값)');
  const secret = () => randomBytes(48).toString('base64');
  const values = {
    DATABASE_URL: driver.databaseUrl,
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

async function serverIsUp() {
  try {
    const response = await fetch('http://localhost:3000/health', {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function buildAndStart() {
  if (await serverIsUp()) {
    log(
      '백엔드가 이미 http://localhost:3000 에서 실행 중이에요 (새로 띄우지 않음)',
    );
    return;
  }
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
  console.log(
    '\n  시험 계정: 휴대폰 01099999999 / 비밀번호 1234567890\n  (db/dumps/README.md 참고)\n',
  );
  const server = spawn(process.execPath, ['--env-file=.env', 'dist/main.js'], {
    cwd: backendDir,
    stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.kill(signal));
  }
  server.on('exit', (code) => process.exit(code ?? 0));
}

/** 지금 DB를 덤프 파일로 저장 (PowerShell 5.1의 > 는 인코딩이 깨져서 Node가 바이트 그대로 쓴다) */
function dumpDatabase(driver) {
  const out = resolve(valueOf('--out') ?? defaultDump);
  log(`"${driver.database}" DB를 덤프로 저장 → ${out}`);
  const result = driver.dump();
  if (result.status !== 0 || !result.stdout) {
    fail(`덤프에 실패했어요.\n${result.err}`);
  }
  writeFileSync(out, result.stdout);
  const hash = createHash('sha256').update(result.stdout).digest('hex');
  const name = out.split(/[\\/]/).pop();
  writeFileSync(resolve(dirname(out), 'SHA256.txt'), `${hash} *${name}\n`);
  log(
    `완료: ${(result.stdout.length / 1024).toFixed(0)}KB, sha256 ${hash.slice(0, 12)}…`,
  );
}

const driver = chooseDriver();
await driver.prepare();
if (has('--dump')) {
  dumpDatabase(driver);
} else {
  restoreDump(driver);
  prepareEnv(driver);
  if (has('--no-start')) {
    log('준비 완료 (--no-start: 서버는 띄우지 않음)');
  } else {
    await buildAndStart();
  }
}
