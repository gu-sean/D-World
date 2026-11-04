// SQL 마이그레이션 적용기: order.txt 순서(없으면 파일명 순) 실행, schema_migrations에 파일명·체크섬 기록
// 사용: node scripts/migrate.mjs [디렉터리]   (기본 MIGRATIONS_DIR 또는 ../db/migrations)
// 대상 DB는 DATABASE_URL, 각 파일은 자체 BEGIN/COMMIT 포함 전제
//
// 이 파일은 backend/scripts/migrate.mjs의 교체본이다 (원본 대비 변경: listMigrations 추가,
// 파일 목록을 파일명 정렬 대신 order.txt 순서로 읽음). 백엔드 브랜치에서 교체해서 사용한다.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

const dir = resolve(
  process.argv[2] ?? process.env.MIGRATIONS_DIR ?? '../db/migrations',
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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
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
