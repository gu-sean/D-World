import { newId } from '../../src/common/ids.js';
import Test from 'supertest/lib/test.js';

/**
 * 앱 API(/api/v1) POST에 Idempotency-Key를 자동으로 붙임 (테스트 전용)
 * 키 동작을 직접 검증하는 테스트는 명시적으로 set()한 값이 우선
 */
const end = Test.prototype.end;
Test.prototype.end = function endWithKey(fn) {
  if (
    this.method === 'POST' &&
    this.url.includes('/api/v1/') &&
    !this._header['idempotency-key']
  ) {
    this.set('Idempotency-Key', newId());
  }
  return end.call(this, fn);
};
