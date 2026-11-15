/**
 * 읽기용 서명 주소(presignGet) 재사용.
 *
 * 펫 이미지처럼 같은 파일을 여러 요청이 읽는 경우, 요청마다 새로 서명하면 같은 계산을 반복하고
 * 주소가 매번 달라져서 앱의 이미지 캐시도 같은 그림을 다시 받는다. 같은 키·같은 유효 시간이면
 * 만료 직전까지 같은 주소를 돌려준다.
 *
 * - 비공개 영상·사진 같은 개인 자료에는 쓰지 않는다(유효 시간이 짧고 용도가 다르다). 이미지 표시용만.
 * - 만료 `REFRESH_BEFORE_SEC`초 전부터는 새로 만든다 — 앱이 받은 주소가 곧 만료되는 일이 없도록.
 * - 보관 개수는 `MAX_ENTRIES`로 막는다(가장 오래 안 쓴 것부터 버림).
 */

const REFRESH_BEFORE_SEC = 600;
const MAX_ENTRIES = 500;

// 저장소 객체마다 따로 보관한다(테스트에서 다른 가짜 저장소와 섞이지 않게)
const caches = new WeakMap();

/**
 * @param {{presignGet: (args: {key: string, expiresInSec: number}) => Promise<string>|string}} storage
 * @param {{key: string, expiresInSec: number}} args
 * @param {number} [nowMs] 시험용으로 시각을 바꿀 수 있다
 */
export async function presignGetCached(
  storage,
  { key, expiresInSec },
  nowMs = Date.now(),
) {
  let cache = caches.get(storage);
  if (!cache) {
    cache = new Map();
    caches.set(storage, cache);
  }

  const cacheKey = `${expiresInSec}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.refreshAt > nowMs) {
    // 최근에 쓴 것으로 표시(Map은 넣은 순서를 지키므로 지웠다 다시 넣는다)
    cache.delete(cacheKey);
    cache.set(cacheKey, hit);
    return hit.url;
  }

  const url = await storage.presignGet({ key, expiresInSec });
  const refreshAt =
    nowMs + Math.max(expiresInSec - REFRESH_BEFORE_SEC, 0) * 1000;
  cache.delete(cacheKey);
  cache.set(cacheKey, { url, refreshAt });
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  return url;
}
