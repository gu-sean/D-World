import {
  formatDate,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatNumber,
  formatPoints,
  formatRate,
  formatTime,
  keepWords,
  toDateString,
} from '../format';

describe('날짜', () => {
  test('날짜 문자열을 "월 일 (요일)"로 쓴다', () => {
    expect(formatDate('2026-11-04')).toBe('11월 4일 (수)');
    expect(formatDate('2026-11-04', { withYear: true })).toBe('2026년 11월 4일 (수)');
  });

  test('알 수 없는 값은 빈 문자열', () => {
    expect(formatDate('날짜아님')).toBe('');
    expect(formatDate(null)).toBe('');
  });

  test('서버가 주는 UTC 시각은 한국 시간 기준으로 바꾼다', () => {
    // UTC 14:30 → 한국 23:30, 날짜는 그대로 / UTC 15:30 → 한국 다음날 00:30
    expect(toDateString('2026-11-04T14:30:00Z')).toBe('2026-11-04');
    expect(toDateString('2026-11-04T15:30:00Z')).toBe('2026-11-05');
  });

  test('시각을 오전·오후로 쓴다', () => {
    expect(formatTime('2026-11-04T05:15:00Z')).toBe('오후 2:15');
    expect(formatTime('2026-11-03T15:00:00Z')).toBe('오전 12:00');
    expect(formatDateTime('2026-11-04T05:15:00Z')).toBe('11월 4일 (수) 오후 2:15');
  });
});

describe('숫자', () => {
  test('걸린 시간', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(1520)).toBe('25:20');
    expect(formatDuration(3900)).toBe('1:05:00');
    expect(formatDuration(-5)).toBe('0:00');
  });

  test('거리는 1km 미만이면 m, 이상이면 km로 쓴다', () => {
    expect(formatDistance(850)).toBe('850m');
    expect(formatDistance(3120)).toBe('3.12km');
    expect(formatDistance(2000)).toBe('2km');
    expect(formatDistance('abc')).toBe('');
  });

  test('포인트와 천 단위 쉼표', () => {
    expect(formatNumber(8000)).toBe('8,000');
    expect(formatPoints(1250)).toBe('1,250P');
    expect(formatPoints(1250.9)).toBe('1,250P');
    expect(formatPoints(undefined)).toBe('');
  });

  test('비율을 퍼센트로 쓴다', () => {
    expect(formatRate(0.7213)).toBe('72%');
    expect(formatRate(0.7213, { digits: 1 })).toBe('72.1%');
    expect(formatRate(NaN)).toBe('');
  });
});

describe('keepWords (한글 단어 중간 줄바꿈 방지)', () => {
  const JOINER = '⁠';

  test('같은 단어의 글자 사이에만 줄바꿈 금지 문자를 넣는다', () => {
    expect(keepWords('안전하게 시작')).toBe(`안${JOINER}전${JOINER}하${JOINER}게 시${JOINER}작`);
  });

  test('공백은 그대로 두어 줄이 공백에서 바뀔 수 있다', () => {
    expect(keepWords('가 나')).toBe('가 나');
  });

  test('문자열이 아니면 그대로 돌려준다', () => {
    expect(keepWords(undefined)).toBeUndefined();
    expect(keepWords(null)).toBeNull();
  });
});
