// 총괄 관리자 계정 생성, 가입 API는 없고 배포·운영 절차로만 만든다
// 사용: ADMIN_PASSWORD='...' node --env-file-if-exists=.env scripts/create-admin.mjs <login_id> <email>
import { newId } from '../src/common/ids.js';
import argon2 from 'argon2';
import pg from 'pg';

const [loginId, rawEmail] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!loginId || !rawEmail || !password || !databaseUrl) {
  console.error(
    '사용: ADMIN_PASSWORD=... DATABASE_URL=... node scripts/create-admin.mjs <login_id> <email>',
  );
  process.exit(1);
}
if (!/^[A-Za-z0-9_]{3,50}$/.test(loginId)) {
  console.error('login_id는 영문·숫자·밑줄 3~50자');
  process.exit(1);
}
const email = rawEmail.trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error('이메일 형식이 올바르지 않음');
  process.exit(1);
}
if (password.length < 12) {
  console.error('관리자 비밀번호는 12자 이상');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  // 관리자는 총괄 1명
  const { rows } = await client.query(
    'SELECT count(*) AS n FROM admin_accounts',
  );
  if (Number(rows[0].n) > 0) {
    console.error('이미 관리자 계정이 있음, 총괄 관리자는 1명');
    process.exit(1);
  }
  await client.query(
    `INSERT INTO admin_accounts (id, login_id, email, password_hash)
     VALUES ($1, $2, $3, $4)`,
    [
      newId(),
      loginId,
      email,
      await argon2.hash(password, { type: argon2.argon2id }),
    ],
  );
  console.log(`관리자 생성: ${loginId}`);
} finally {
  await client.end();
}
