import { transactionTitle } from '../../../src/mobile-rewards/mobile-rewards.service.js';

describe('transactionTitle', () => {
  it('미션 보상은 미션 제목과 결과', () => {
    expect(
      transactionTitle({
        sourceType: 'mission',
        sourceName: '스쿼트 15개',
        availableDelta: 50,
      }),
    ).toBe('스쿼트 15개 인증 성공');
    expect(
      transactionTitle({
        sourceType: 'mission',
        sourceName: '스쿼트 15개',
        availableDelta: -50,
      }),
    ).toBe('스쿼트 15개 보상 회수');
  });

  it('상점 주문은 차감이면 교환, 환불이면 환불', () => {
    expect(
      transactionTitle({
        sourceType: 'shop_order',
        sourceName: '펫 간식',
        availableDelta: -300,
      }),
    ).toBe('펫 간식 교환');
    expect(
      transactionTitle({
        sourceType: 'shop_order',
        sourceName: '펫 간식',
        availableDelta: 300,
      }),
    ).toBe('펫 간식 환불');
  });

  it('이름을 알 수 없거나 고정 제목인 경우', () => {
    expect(
      transactionTitle({ sourceType: 'mission', availableDelta: 10 }),
    ).toBe('미션 인증 성공');
    expect(
      transactionTitle({ sourceType: 'streak', availableDelta: 100 }),
    ).toBe('연속 달성 보상');
    expect(transactionTitle({ sourceType: 'unknown', availableDelta: 1 })).toBe(
      '포인트 변동',
    );
  });
});
