// 펫 정지 썸네일 업로드: image/still/*.png를 각 GIF 옆(.still.png)으로 R2에 올린다.
// 사용: node --env-file=.env --env-file=.env.supabase scripts/upload-pet-stills.mjs [--apply]
//   --apply 없이 돌리면 올릴 목록만 보여 준다. 이미 올라간 것도 같은 내용으로 덮어쓰므로 여러 번 돌려도 안전하다.
// 키 규칙: .../adult-AbCd1234.gif → .../adult-AbCd1234.still.png (서버가 같은 규칙으로 주소를 만든다)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const stillDir = resolve(import.meta.dirname, '../../image/still');

// 종류 code → image/ 폴더의 파일 이름 머리글 (seed-pet-species.mjs와 같은 표)
const FILES = {
  dog: '강아지',
  cat: '고양이',
  giraffe: '기린',
  pig: '돼지',
  lion: '사자',
  shark: '상어',
  crocodile: '악어',
  rabbit: '토끼',
  penguin: '펭귄',
  tiger: '호랑이',
  bear: '곰',
  wolf: '늑대',
  squirrel: '다람쥐',
  deer: '사슴',
  fox: '여우',
  monkey: '원숭이',
  elephant: '코끼리',
  rhino: '코뿔소',
  koala: '코알라',
  panda: '판다',
  hippo: '하마',
};
const need = (name) => {
  if (!process.env[name])
    throw new Error(`${name} 환경변수가 필요합니다 (.env.supabase 확인)`);
  return process.env[name];
};

const caPath =
  process.env.DATABASE_SSL_CA && resolve(process.env.DATABASE_SSL_CA);
const db = new pg.Client({
  connectionString: need('DATABASE_URL'),
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? caPath
        ? { ca: readFileSync(caPath, 'utf8') }
        : true
      : false,
});
await db.connect();
try {
  const { rows } = await db.query(
    `SELECT s.code, i.r2_object_key AS key
       FROM pet_stage_images i JOIN pet_species s ON s.id = i.species_id
      WHERE i.mime_type = 'image/gif'`,
  );
  const jobs = [];
  for (const { code, key } of rows) {
    const name = FILES[code];
    const n = key.includes('/baby-') ? 1 : key.includes('/adult-') ? 2 : null;
    if (!name || !n) continue;
    jobs.push({
      code,
      key: key.replace(/\.gif$/, '.still.png'),
      file: resolve(stillDir, `${name}_${n}.png`),
    });
  }
  console.log(`올릴 정지 썸네일 ${jobs.length}개 (GIF ${rows.length}개 중)`);
  if (!apply) {
    for (const j of jobs.slice(0, 4)) console.log(`  ${j.code}: ${j.key}`);
    console.log('  …\n\n드라이런입니다. 실제로 올리려면 --apply 를 붙이세요.');
    process.exit(0);
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint:
      process.env.R2_ENDPOINT ||
      `https://${need('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: need('R2_ACCESS_KEY_ID'),
      secretAccessKey: need('R2_SECRET_ACCESS_KEY'),
    },
  });
  for (const j of jobs) {
    await s3.send(
      new PutObjectCommand({
        Bucket: need('R2_BUCKET'),
        Key: j.key,
        Body: readFileSync(j.file),
        ContentType: 'image/png',
      }),
    );
  }
  console.log(`업로드 완료: ${jobs.length}개`);
} finally {
  await db.end();
}
