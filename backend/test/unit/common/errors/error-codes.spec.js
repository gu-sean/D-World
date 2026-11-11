import {
  ERROR_CODES,
  resolveCode,
} from '../../../../src/common/errors/error-codes.js';

describe('05 §7 추가 코드', () => {
  it.each([
    ['SHOP_ITEM_UNAVAILABLE', 409],
    ['SHOP_PRICE_CHANGED', 409],
    ['SHOP_ALREADY_OWNED', 409],
    ['RECOMMENDATION_RATE_LIMITED', 429],
    ['RECOMMENDATION_EXPIRED', 410],
    ['RECOMMENDATION_NOT_OPEN', 409],
    ['SUPPORT_DUPLICATE_REPORT', 409],
    ['AI_INVALID_REQUEST', 400],
    ['AI_MEDIA_UNAVAILABLE', 422],
  ])('%s → %i', (code, status) => {
    expect(ERROR_CODES[code][0]).toBe(status);
    expect(resolveCode(code, status).code).toBe(code);
  });

  it('상점 판매 불가는 SHOP_ITEM_UNAVAILABLE로 노출', () => {
    expect(resolveCode('item_unavailable', 409).code).toBe(
      'SHOP_ITEM_UNAVAILABLE',
    );
  });
});
