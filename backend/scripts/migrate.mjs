// SQL 마이그레이션 적용기: order.txt 순서(없으면 파일명 순) 실행, schema_migrations에 파일명·체크섬 기록
// 사용: node scripts/migrate.mjs [디렉터리]   (기본 MIGRATIONS_DIR 또는 ../db/migrations)
//       node scripts/migrate.mjs reset [--db 이름] [디렉터리]
//         reset: 대상 DB를 비우고(public 스키마 삭제 후 재생성) 처음부터 다시 적용, 개발·테스트 전용
//         --db: DATABASE_URL의 DB 이름을 바꿔서 사용(없으면 생성)
// 대상 DB는 DATABASE_URL, 각 파일은 자체 BEGIN/COMMIT 포함 전제
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const isReset = args[0] === 'reset';
if (isReset) args.shift();
const dbFlag = args.indexOf('--db');
const dbName = dbFlag >= 0 ? args.splice(dbFlag, 2)[1] : undefined;
const dir = resolve(
  args[0] ?? process.env.MIGRATIONS_DIR ?? '../db/migrations',
);
if (!existsSync(dir)) {
  console.error(`마이그레이션 디렉터리 없음: ${dir}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 필요');
  process.exit(1);
}

// 실행 순서: 디렉터리에 order.txt가 있으면 그 목록(한 줄에 파일명, # 주석)을 따르고,
// 없으면 파일명 정렬. 목록과 실제 파일이 어긋나면 적용 전에 오류로 멈춘다.
async function listMigrations(directory) {
  const present = (await readdir(directory)).filter((f) => f.endsWith('.sql'));
  const orderFile = join(directory, 'order.txt');
  if (!existsSync(orderFile)) return present.sort();

  const listed = (await readFile(orderFile, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const duplicated = listed.filter((f, i) => listed.indexOf(f) !== i);
  const missing = listed.filter((f) => !present.includes(f));
  const unlisted = present.filter((f) => !listed.includes(f));
  if (duplicated.length || missing.length || unlisted.length) {
    throw new Error(
      `order.txt와 파일이 다름 (중복: ${duplicated.join(', ') || '없음'}, ` +
        `파일 없음: ${missing.join(', ') || '없음'}, 목록에 없음: ${unlisted.join(', ') || '없음'})`,
    );
  }
  return listed;
}

if (isReset && process.env.NODE_ENV === 'production') {
  console.error('운영 환경에서는 reset을 실행할 수 없음');
  process.exit(1);
}

const targetUrl = new URL(process.env.DATABASE_URL);
if (dbName) {
  // 지정한 DB가 없으면 만든 뒤 그 DB를 대상으로 사용
  const adminUrl = new URL(targetUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.href });
  await admin.connect();
  try {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (exists.rowCount === 0)
      await admin.query(`CREATE DATABASE "${dbName.replaceAll('"', '')}"`);
  } finally {
    await admin.end();
  }
  targetUrl.pathname = `/${dbName}`;
}

// 원격 DB(Supabase 등): DATABASE_SSL=true, 인증서는 DATABASE_SSL_CA 파일로 검증
const ssl =
  process.env.DATABASE_SSL === 'true'
    ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_SSL_CA
          ? { ca: readFileSync(process.env.DATABASE_SSL_CA, 'utf8') }
          : {}),
      }
    : undefined;
const client = new pg.Client({ connectionString: targetUrl.href, ssl });
await client.connect();

try {
  if (isReset) {
    console.log(`초기화: ${targetUrl.pathname.slice(1)}`);
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  const applied = new Map(
    (
      await client.query('SELECT filename, checksum FROM schema_migrations')
    ).rows.map((r) => [r.filename, r.checksum]),
  );

  const files = await listMigrations(dir);
  let count = 0;
  for (const file of files) {
    const sql = await readFile(join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    if (applied.has(file)) {
      // 적용된 파일이 수정되면 스키마 불일치, 새 파일로 추가해야 함
      if (applied.get(file) !== checksum) {
        throw new Error(`적용된 마이그레이션이 변경됨: ${file}`);
      }
      continue;
    }

    console.log(`적용: ${file}`);
    try {
      await client.query(sql);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    }
    await client.query(
      'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
      [file, checksum],
    );
    count++;
  }
  console.log(
    count === 0 ? '적용할 마이그레이션 없음' : `${count}개 적용 완료`,
  );
} catch (err) {
  console.error(`마이그레이션 실패: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
