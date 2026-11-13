import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..');

/** 덤프의 schema_migrations 에 적힌 파일 이름들 */
function migrationsInDump(sql) {
  const start = sql.indexOf('COPY public.schema_migrations');
  const end = sql.indexOf('\n\\.\n', start); // COPY 데이터의 끝 표시(\.)
  return sql
    .slice(sql.indexOf('\n', start) + 1, end)
    .split('\n')
    .map((line) => line.split('\t')[0])
    .filter(Boolean);
}

describe('시연 덤프(db/dumps/d_world_demo.sql)', () => {
  it('마이그레이션 파일과 같은 목록이 적용된 상태여야 함 (마이그레이션을 추가했으면 npm run demo:refresh)', () => {
    const dump = readFileSync(
      resolve(root, 'db/dumps/d_world_demo.sql'),
      'utf8',
    );
    const files = readdirSync(resolve(root, 'db/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    expect(migrationsInDump(dump)).toEqual(files);
  });
});
