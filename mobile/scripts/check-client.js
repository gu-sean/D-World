#!/usr/bin/env node
/**
 * `src/client/`이 기능 모듈로 남아 있는지 검사한다 (parts/mobile-client §2).
 *
 *  1. 확장자는 `.js`만 — `.jsx`는 화면 코드다.
 *  2. JSX 문법을 쓰지 않는다.
 *  3. `react-native`에서는 `Platform`·`AppState`·`Linking`만 가져온다 (UI 컴포넌트 금지).
 *  4. UI 라이브러리를 import 하지 않는다.
 *  5. 모든 파일이 문법에 맞는다.
 *
 * 실행: `npm run check:client`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const CLIENT_DIR = path.join(ROOT, 'src', 'client');

/** `react-native`에서 가져와도 되는 것. */
const ALLOWED_RN = new Set(['Platform', 'AppState', 'Linking']);

/** 통째로 금지하는 import. */
const BANNED_PACKAGES = [
  'react-native-safe-area-context',
  'react-native-screens',
  '@react-navigation/native',
  '@react-navigation/native-stack',
  '@react-navigation/bottom-tabs',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-svg',
  'react-native-vector-icons',
];

const problems = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** 주석과 문자열을 지워서 오탐을 줄인다. */
function stripNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

function checkFile(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const ext = path.extname(file);

  if (ext !== '.js') {
    problems.push(`${rel}: src/client 안에는 .js만 둘 수 있어요 (화면 코드는 최정훈 폴더로).`);
    return;
  }

  const source = readFileSync(file, 'utf8');
  const code = stripNoise(source);

  // 2. JSX — `<Tag ...>` 또는 `</Tag>` 모양
  const jsx = code.match(/<\/?[A-Za-z][A-Za-z0-9.]*(\s[^<>]*)?\/?>/);
  if (jsx) {
    problems.push(`${rel}: JSX로 보이는 부분이 있어요 (${jsx[0].trim().slice(0, 40)}). src/client에는 화면 코드를 두지 않아요.`);
  }

  // 3. react-native import
  // `[^;]`으로 앞 import 문을 넘어가지 않게 막는다 (여러 줄 destructuring은 허용).
  for (const m of source.matchAll(/import\s+([^;]*?)\s+from\s+['"]react-native['"]/g)) {
    const clause = m[1].trim();
    if (!clause.startsWith('{')) {
      problems.push(`${rel}: react-native는 이름을 콕 집어 가져와야 해요 (import { Platform } from 'react-native').`);
      continue;
    }
    const names = clause.replace(/[{}]/g, '').split(',').map((s) => s.split(' as ')[0].trim()).filter(Boolean);
    for (const name of names) {
      if (!ALLOWED_RN.has(name)) {
        problems.push(`${rel}: react-native의 ${name}은(는) 쓸 수 없어요 (허용: ${[...ALLOWED_RN].join(', ')}).`);
      }
    }
  }

  // 4. UI 라이브러리
  for (const pkg of BANNED_PACKAGES) {
    if (new RegExp(`from\\s+['"]${pkg.replace(/[/@-]/g, '\\$&')}['"]`).test(source)) {
      problems.push(`${rel}: ${pkg}은(는) 화면 라이브러리예요. src/client에서 쓰지 않아요.`);
    }
  }

  // 5. 문법 (`--experimental-vm-modules`로 실행할 때만)
  if (typeof vm.SourceTextModule === 'function') {
    try {
      // eslint-disable-next-line no-new
      new vm.SourceTextModule(source, { identifier: rel });
    } catch (error) {
      problems.push(`${rel}: 문법 오류 — ${error.message}`);
    }
  }
}

let files = [];
try {
  files = walk(CLIENT_DIR);
} catch {
  console.error(`src/client/을 찾을 수 없어요: ${CLIENT_DIR}`);
  process.exit(1);
}

for (const file of files) checkFile(file);

if (problems.length > 0) {
  console.error(`check:client 실패 — ${problems.length}건\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`check:client 통과 — ${files.length}개 파일`);
