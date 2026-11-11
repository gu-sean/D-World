import { fromMobileChallengeInput } from '../../../src/challenges/mobile-challenges.service.js';

describe('fromMobileChallengeInput', () => {
  it('기간·정원·완주 비율을 기존 입력으로 바꿈', () => {
    expect(
      fromMobileChallengeInput({
        title: '2주 스쿼트',
        exerciseCode: 'squat',
        startDate: '2026-11-20',
        periodDays: 14,
        capacity: 50,
        completionRateRequired: 0.8,
      }),
    ).toEqual({
      title: '2주 스쿼트',
      exerciseCode: 'squat',
      startDate: '2026-11-20',
      endDate: '2026-12-03',
      maxParticipants: 50,
      requiredSuccessDays: 12,
      verificationMethod: 'camera',
    });
  });

  it('러닝은 센서 인증, 직접 지정한 값은 덮어쓰지 않음', () => {
    expect(
      fromMobileChallengeInput({
        exerciseCode: 'running',
        startDate: '2026-11-20',
        endDate: '2026-11-26',
        completionRateRequired: 0.5,
      }),
    ).toMatchObject({ verificationMethod: 'sensor', requiredSuccessDays: 4 });
    expect(
      fromMobileChallengeInput({
        startDate: '2026-11-20',
        periodDays: 7,
        endDate: '2026-11-25',
        requiredSuccessDays: 3,
        completionRateRequired: 1,
        verificationMethod: 'camera',
        exerciseCode: 'running',
      }),
    ).toMatchObject({
      endDate: '2026-11-25',
      requiredSuccessDays: 3,
      verificationMethod: 'camera',
    });
  });

  it('기존 입력은 그대로 통과', () => {
    const legacy = {
      title: 't',
      startDate: '2026-11-20',
      endDate: '2026-11-26',
      requiredSuccessDays: 5,
      maxParticipants: 10,
    };
    expect(fromMobileChallengeInput(legacy)).toEqual(legacy);
    expect(fromMobileChallengeInput(undefined)).toBeUndefined();
  });
});
