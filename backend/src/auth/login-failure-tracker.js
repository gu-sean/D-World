/**
 * 비밀번호 로그인 실패 추적 (무차별 대입 방어)
 *
 * 예전에는 실패를 "계정" 하나로만 세서, 번호만 아는 제3자가 5번 틀려 주인의 로그인을 계속 막을 수 있었다.
 * 그래서 두 겹으로 나눈다.
 *  1. 출처별 잠금: (계정, 요청 IP)마다 연속 5회 실패하면 그 출처만 5분 잠근다.
 *     다른 IP(주인)의 로그인은 막히지 않는다.
 *  2. 계정 전체 보호막: 여러 출처에서 15분 안에 30회 넘게 틀리면 계정을 5분 잠근다.
 *     IP 하나는 출처별 잠금 때문에 15분에 15회까지만 틀릴 수 있어 이 한도에 혼자 닿지 못하고,
 *     IP를 여러 개 쓰는 분산 시도만 막는다.
 *
 * 상태는 이 프로세스의 메모리에만 둔다(요청 제한 throttler와 같은 방식).
 * 재시작하면 비워지고, 서버를 여러 대로 늘리면 대수만큼 한도가 늘어난다.
 */
export const MAX_FAILURES_PER_SOURCE = 5;
export const MAX_FAILURES_PER_ACCOUNT = 30;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 5 * 60_000;
const MAX_ENTRIES = 20_000;

export class LoginFailureTracker {
  /** @type {Map<string, {count: number, lastAt: number, lockedUntil: number}>} */
  sources = new Map();
  /** @type {Map<string, {failures: number[], lockedUntil: number}>} */
  accounts = new Map();

  constructor({
    maxPerSource = MAX_FAILURES_PER_SOURCE,
    maxPerAccount = MAX_FAILURES_PER_ACCOUNT,
    windowMs = WINDOW_MS,
    lockMs = LOCK_MS,
    maxEntries = MAX_ENTRIES,
    now = () => Date.now(),
  } = {}) {
    this.maxPerSource = maxPerSource;
    this.maxPerAccount = maxPerAccount;
    this.windowMs = windowMs;
    this.lockMs = lockMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  static sourceKey(userId, ip) {
    return `${userId}|${ip || 'unknown'}`;
  }

  /**
   * 지금 이 출처에서 이 계정으로 로그인을 시도해도 되는가 (비밀번호를 검사하기 전에 부른다)
   * @returns {{locked: false} | {locked: true, retryAfterSeconds: number}}
   */
  check(userId, ip) {
    const now = this.now();
    const until = Math.max(
      this.sources.get(LoginFailureTracker.sourceKey(userId, ip))
        ?.lockedUntil ?? 0,
      this.accounts.get(userId)?.lockedUntil ?? 0,
    );
    return until > now
      ? {
          locked: true,
          retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)),
        }
      : { locked: false };
  }

  /**
   * 비밀번호가 틀렸다고 기록한다
   * @returns {{locked: false} | {locked: true, retryAfterSeconds: number}} 이번 실패로 잠겼으면 locked
   */
  recordFailure(userId, ip) {
    const now = this.now();
    const key = LoginFailureTracker.sourceKey(userId, ip);

    // 출처별: 잠금이 풀린 뒤 첫 실패는 1회부터, 오래 쉬었어도 1회부터 다시 센다
    let source = this.sources.get(key);
    if (!source || source.lockedUntil <= now) {
      const stale =
        !source ||
        now - source.lastAt > this.windowMs ||
        source.lockedUntil > 0;
      source = { count: stale ? 0 : source.count, lastAt: now, lockedUntil: 0 };
    }
    source.count += 1;
    source.lastAt = now;
    if (source.count >= this.maxPerSource)
      source.lockedUntil = now + this.lockMs;
    this.sources.delete(key);
    this.sources.set(key, source);

    // 계정 전체: 최근 windowMs 안의 실패만 센다
    const account = this.accounts.get(userId) ?? {
      failures: [],
      lockedUntil: 0,
    };
    account.failures = account.failures.filter(
      (at) => now - at <= this.windowMs,
    );
    account.failures.push(now);
    if (
      account.lockedUntil <= now &&
      account.failures.length >= this.maxPerAccount
    ) {
      account.lockedUntil = now + this.lockMs;
      account.failures = [];
    }
    this.accounts.delete(userId);
    this.accounts.set(userId, account);

    this.prune(now);
    return this.check(userId, ip);
  }

  /** 로그인에 성공했다: 이 출처의 실패 기록을 지운다 (계정 전체 기록은 남긴다) */
  recordSuccess(userId, ip) {
    this.sources.delete(LoginFailureTracker.sourceKey(userId, ip));
  }

  /** 비밀번호 재설정 등으로 계정의 모든 기록을 비운다 */
  clearAccount(userId) {
    this.accounts.delete(userId);
    const prefix = `${userId}|`;
    for (const key of this.sources.keys())
      if (key.startsWith(prefix)) this.sources.delete(key);
  }

  /** 메모리 상한: 끝난 기록을 먼저 지우고, 그래도 넘으면 가장 오래된 것부터 지운다 */
  prune(now) {
    if (this.sources.size > this.maxEntries) {
      for (const [key, s] of this.sources) {
        if (s.lockedUntil <= now && now - s.lastAt > this.windowMs)
          this.sources.delete(key);
      }
      for (const key of this.sources.keys()) {
        if (this.sources.size <= this.maxEntries) break;
        this.sources.delete(key);
      }
    }
    if (this.accounts.size > this.maxEntries) {
      for (const [key, a] of this.accounts) {
        const recent = a.failures.some((at) => now - at <= this.windowMs);
        if (a.lockedUntil <= now && !recent) this.accounts.delete(key);
      }
      for (const key of this.accounts.keys()) {
        if (this.accounts.size <= this.maxEntries) break;
        this.accounts.delete(key);
      }
    }
  }
}
