// 동물 펫 종류 일괄 등록: image/ 폴더의 GIF(이름_1 = 아기, 이름_2 = 성체)를 R2에 올리고 펫 종류를 만든다.
// 사용: node --env-file=.env --env-file=.env.supabase scripts/seed-pet-species.mjs [--apply]
//   --apply 없이 돌리면 아무것도 쓰지 않고 계획만 보여 준다(드라이런).
//   이미 같은 code가 있으면 건너뛰므로 여러 번 돌려도 안전하다.
// 알(1단계) 이미지는 아직 없어서 모든 종류가 같은 임시 PNG(연한 단색 1픽셀)를 쓴다.
//   진짜 알 이미지가 생기면 관리자 웹에서 종류별 새 버전으로 바꾼다.
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const imageDir = resolve(import.meta.dirname, '../../image');

// code: 소문자·밑줄, name: 앱에 보이는 이름, file: image/ 폴더의 파일 이름 머리글
const SPECIES = [
  ['dog', '강아지', '강아지'],
  ['cat', '고양이', '고양이'],
  ['giraffe', '기린', '기린'],
  ['pig', '돼지', '돼지'],
  ['lion', '사자', '사자'],
  ['shark', '상어', '상어'],
  ['crocodile', '악어', '악어'],
  ['rabbit', '토끼', '토끼'],
  ['penguin', '펭귄', '펭귄'],
  ['tiger', '호랑이', '호랑이'],
  ['bear', '곰', '곰'],
  ['wolf', '늑대', '늑대'],
  ['squirrel', '다람쥐', '다람쥐'],
  ['deer', '사슴', '사슴'],
  ['fox', '여우', '여우'],
  ['monkey', '원숭이', '원숭이'],
  ['elephant', '코끼리', '코끼리'],
  ['rhino', '코뿔소', '코뿔소'],
  ['koala', '코알라', '코알라'],
  ['panda', '판다', '판다'],
  ['hippo', '하마', '하마'],
];
const STAGES = [
  { no: 1, code: 'egg', minXp: 0, bonus: 500 },
  { no: 2, code: 'baby', minXp: 50, bonus: 1000 },
  { no: 3, code: 'adult', minXp: 200, bonus: 1500 },
];
const HATCH_MISSION_COUNT = 3;

// backend/src/common/ids.js와 같은 규칙(8자 영숫자)
const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const newId = () =>
  Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    '',
  );

// 연한 단색 1x1 PNG
function placeholderPng() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // 비트 깊이
  ihdr[9] = 2; // RGB
  const pixel = Buffer.from([0, 0xf5, 0xee, 0xe0]); // 필터 0 + 연한 베이지
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixel)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const need = (name) => {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} 환경변수가 필요합니다 (.env.supabase 확인)`);
  return value;
};

const gifOf = (file, n) => {
  const path = join(imageDir, `${file}_${n}.gif`);
  return { path, bytes: readFileSync(path) };
};

const prefix = need('R2_KEY_PREFIX');
const egg = placeholderPng();
const plan = SPECIES.map(([code, name, file]) => ({
  code,
  name,
  stages: [
    { ...STAGES[0], mime: 'image/png', bytes: egg },
    { ...STAGES[1], mime: 'image/gif', ...gifOf(file, 1) },
    { ...STAGES[2], mime: 'image/gif', ...gifOf(file, 2) },
  ],
}));
for (const item of plan) {
  for (const stage of item.stages) {
    if (stage.bytes.length > 2 * 1024 * 1024) {
      throw new Error(`${item.name} ${stage.code} 이미지가 2MB를 넘음`);
    }
  }
}

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
  const { rows: admins } = await db.query(
    `SELECT id FROM admin_accounts ORDER BY created_at LIMIT 1`,
  );
  const { rows: cats } = await db.query(
    `SELECT id FROM goal_categories WHERE code = 'exercise'`,
  );
  if (!admins[0] || !cats[0])
    throw new Error('관리자 또는 운동 카테고리가 없음');
  const adminId = admins[0].id;
  const categoryId = cats[0].id;

  const { rows: existing } = await db.query(`SELECT code FROM pet_species`);
  const have = new Set(existing.map((r) => r.code));
  const todo = plan.filter((item) => !have.has(item.code));
  console.log(
    `기존 ${have.size}종, 새로 등록 ${todo.length}종 (건너뜀 ${plan.length - todo.length}종)`,
  );
  for (const item of todo) {
    const sizes = item.stages.map(
      (s) => `${s.code} ${(s.bytes.length / 1024).toFixed(0)}KB`,
    );
    console.log(`  - ${item.code} (${item.name}): ${sizes.join(', ')}`);
  }
  if (!apply) {
    console.log('\n드라이런입니다. 실제로 등록하려면 --apply 를 붙이세요.');
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
  const bucket = need('R2_BUCKET');

  for (const item of todo) {
    const speciesId = newId();
    const versionId = newId();
    const images = item.stages.map((stage) => ({
      ...stage,
      id: newId(),
      key: `${prefix}/assets/pets/${speciesId}/${stage.code}-ID.${stage.mime === 'image/gif' ? 'gif' : 'png'}`,
    }));
    for (const image of images)
      image.key = image.key.replace('-ID.', `-${image.id}.`);

    // 먼저 파일을 올리고, 성공했을 때만 DB에 기록(실패하면 이 종류는 DB에 남지 않음)
    for (const image of images) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: image.key,
          Body: image.bytes,
          ContentType: image.mime,
        }),
      );
    }
    try {
      await db.query('BEGIN');
      await db.query(
        `INSERT INTO pet_species (id, code, name, description, status, created_by_admin_id)
         VALUES ($1, $2, $3, $4, 'public', $5)`,
        [
          speciesId,
          item.code,
          item.name,
          `운동하며 함께 자라는 ${item.name}`,
          adminId,
        ],
      );
      await db.query(
        `INSERT INTO pet_species_versions
           (id, species_id, version_no, name, description, category_id,
            unlock_condition_type, hatch_mission_count, effective_at, created_by_admin_id)
         VALUES ($1, $2, 1, $3, $4, $5, 'none', $6, now() - interval '1 minute', $7)`,
        [
          versionId,
          speciesId,
          item.name,
          `운동하며 함께 자라는 ${item.name}`,
          categoryId,
          HATCH_MISSION_COUNT,
          adminId,
        ],
      );
      for (const image of images) {
        await db.query(
          `INSERT INTO pet_stage_images
             (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, now(), $6)`,
          [
            image.id,
            speciesId,
            image.key,
            image.mime,
            image.bytes.length,
            adminId,
          ],
        );
      }
      for (const image of images) {
        await db.query(
          `INSERT INTO pet_stage_versions
             (species_version_id, species_id, stage_no, stage_code, min_total_xp,
              bonus_basis_points, image_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            versionId,
            speciesId,
            image.no,
            image.code,
            image.minXp,
            image.bonus,
            image.id,
          ],
        );
      }
      await db.query('COMMIT');
      console.log(`등록 완료: ${item.code} (${item.name}) → ${speciesId}`);
    } catch (error) {
      await db.query('ROLLBACK');
      console.error(`등록 실패: ${item.code}`, error.message);
      throw error;
    }
  }
} finally {
  await db.end();
}
