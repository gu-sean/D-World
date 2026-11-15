// 공용 알 이미지 적용: 모든 공개 펫 종류에 같은 알 이미지를 쓰는 새 버전(version_no+1)을 만든다.
// 사용: node --env-file=.env --env-file=.env.supabase scripts/apply-pet-egg.mjs [이미지.png] [--apply]
//   기본 이미지는 ../image/알_공용.png, --apply 없이 돌리면 계획만 보여 준다.
//   버전은 고칠 수 없는 기록이라 새 버전으로 올린다(이미 키우는 펫은 자기 버전을 유지).
//   아기·성체 이미지 행은 그대로 다시 쓰고, 알 이미지만 종류별로 새로 올린다.
//   같은 알 이미지가 이미 현재 버전에 적용된 종류는 건너뛰므로 여러 번 돌려도 안전하다.
import { createHash, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const eggPath = resolve(
  fileArg ?? import.meta.dirname + '/../../image/알_공용.png',
);
const egg = readFileSync(eggPath);
const eggHash = createHash('sha256').update(egg).digest('hex');
if (egg.length > 2 * 1024 * 1024) throw new Error('알 이미지가 2MB를 넘음');

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const newId = () =>
  Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    '',
  );
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
  const { rows: admins } = await db.query(
    'SELECT id FROM admin_accounts ORDER BY created_at LIMIT 1',
  );
  const adminId = admins[0].id;
  const { rows: species } = await db.query(
    `SELECT s.id, s.code FROM pet_species s WHERE s.status = 'public' ORDER BY s.code`,
  );

  const todo = [];
  for (const s of species) {
    // 효력이 시작된 가장 최근 버전 = 앱이 쓰는 버전
    const { rows } = await db.query(
      `SELECT * FROM pet_species_versions
        WHERE species_id = $1 AND effective_at <= now()
        ORDER BY effective_at DESC, version_no DESC LIMIT 1`,
      [s.id],
    );
    const version = rows[0];
    if (!version) continue;
    const { rows: stages } = await db.query(
      `SELECT sv.*, i.r2_object_key, i.size_bytes
         FROM pet_stage_versions sv JOIN pet_stage_images i ON i.id = sv.image_id
        WHERE sv.species_version_id = $1 ORDER BY sv.stage_no`,
      [version.id],
    );
    if (stages.length !== 3) continue;
    if (stages[0].r2_object_key.includes(`-egg-${eggHash.slice(0, 8)}`))
      continue;
    // 같은 크기의 알 이미지가 이미 있으면 이미 적용된 것으로 본다
    if (Number(stages[0].size_bytes) === egg.length) continue;
    todo.push({ species: s, version, stages });
  }
  console.log(
    `알 이미지 ${(egg.length / 1024).toFixed(0)}KB, 적용 대상 ${todo.length}종 (전체 공개 ${species.length}종)`,
  );
  for (const t of todo)
    console.log(
      `  - ${t.species.code}: v${t.version.version_no} → v${t.version.version_no + 1}`,
    );
  if (!apply) {
    console.log('\n드라이런입니다. 실제로 적용하려면 --apply 를 붙이세요.');
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
  const prefix = need('R2_KEY_PREFIX');

  for (const { species: s, version: v, stages } of todo) {
    const imageId = newId();
    const key = `${prefix}/assets/pets/${s.id}/egg-${imageId}.png`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: egg,
        ContentType: 'image/png',
      }),
    );
    const versionId = newId();
    try {
      await db.query('BEGIN');
      await db.query(
        `INSERT INTO pet_stage_images
           (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
         VALUES ($1, $2, $3, 'image/png', $4, now(), $5)`,
        [imageId, s.id, key, egg.length, adminId],
      );
      await db.query(
        `INSERT INTO pet_species_versions
           (id, species_id, version_no, name, description, personality, world_text,
            category_id, unlock_condition_type, unlock_target_count, unlock_category_id,
            unlock_achievement_id, hatch_mission_count, effective_at, created_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 now() - interval '1 minute', $14)`,
        [
          versionId,
          s.id,
          v.version_no + 1,
          v.name,
          v.description,
          v.personality,
          v.world_text,
          v.category_id,
          v.unlock_condition_type,
          v.unlock_target_count,
          v.unlock_category_id,
          v.unlock_achievement_id,
          v.hatch_mission_count,
          adminId,
        ],
      );
      for (const st of stages) {
        await db.query(
          `INSERT INTO pet_stage_versions
             (species_version_id, species_id, stage_no, stage_code, min_total_xp,
              bonus_basis_points, image_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            versionId,
            s.id,
            st.stage_no,
            st.stage_code,
            st.min_total_xp,
            st.bonus_basis_points,
            st.stage_no === 1 ? imageId : st.image_id,
          ],
        );
      }
      await db.query('COMMIT');
      console.log(`적용 완료: ${s.code} → v${v.version_no + 1}`);
    } catch (error) {
      await db.query('ROLLBACK');
      console.error(`적용 실패: ${s.code}`, error.message);
      throw error;
    }
  }
} finally {
  await db.end();
}
