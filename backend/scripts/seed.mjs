// 개발 시드 적용: ../db/seeds/dev/*.sql 을 순서대로 psql로 실행 (docker compose의 postgres 컨테이너 사용)
// 비밀번호 해시는 환경 변수 DEV_ADMIN_PASSWORD, DEV_USER_PASSWORD로 받아 argon2id로 만들어 넘긴다 (저장소에 비밀번호 없음)
// 사용: DEV_ADMIN_PASSWORD=... DEV_USER_PASSWORD=... npm run db:seed
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import argon2 from 'argon2';

if (process.env.NODE_ENV === 'production') {
  console.error('운영 환경에서는 시드를 실행할 수 없음');
  process.exit(1);
}
const { DEV_ADMIN_PASSWORD: adminPassword, DEV_USER_PASSWORD: userPassword } =
  process.env;
if (!adminPassword || !userPassword) {
  console.error('DEV_ADMIN_PASSWORD, DEV_USER_PASSWORD 환경 변수가 필요함');
  process.exit(1);
}

const hash = (password) => argon2.hash(password, { type: argon2.argon2id });
const adminHash = await hash(adminPassword);
const userHash = await hash(userPassword);

const files = readdirSync(new URL('../../db/seeds/dev/', import.meta.url))
  .filter((name) => name.endsWith('.sql'))
  .sort();

for (const file of files) {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      '../docker-compose.yml',
      'exec',
      '-T',
      '-e',
      'PGUSER=dworld',
      '-e',
      'PGPASSWORD=dworld',
      'postgres',
      'psql',
      '-d',
      'd_world',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-v',
      `admin_password_hash=${adminHash}`,
      '-v',
      `user_password_hash=${userHash}`,
      '-f',
      `/db/seeds/dev/${file}`,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error(`시드 실패: ${file}`);
    process.exit(result.status ?? 1);
  }
  console.log(`시드 적용: ${file}`);
}
