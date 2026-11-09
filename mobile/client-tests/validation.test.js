import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePhone,
  validatePassword,
  validatePasswordConfirm,
  validateNickname,
  validatePetNickname,
  validateOtp,
  validateTarget,
  validateLength,
  validatePeriod,
} from '../src/client/validation/rules.js';
import * as formatModule from '../src/client/format/format.js';

const { formatDate, formatTime, formatDuration, formatSpokenDuration, formatDistance, formatPoints, formatRate, formatTarget, todayKst, toDateString } = formatModule;

// ── 11 §8.1 계정·프로필 ────────────────────────────────────────────────

test('휴대폰 번호: 010 + 숫자 8자리만', () => {
  assert.equal(validatePhone('01012345678').ok, true);
  assert.equal(validatePhone('  01012345678  ').ok, true);
  assert.equal(validatePhone('0101234567').ok, false, '10자리는 안 됨');
  assert.equal(validatePhone('010123456789').ok, false, '12자리는 안 됨');
  assert.equal(validatePhone('01112345678').ok, false, '011은 안 됨');
  assert.equal(validatePhone('010-1234-5678').ok, false, '하이픈은 안 됨');
  assert.equal(validatePhone('').ok, false);
});

test('비밀번호: 10~64자 경계값', () => {
  assert.equal(validatePassword('a'.repeat(9)).ok, false);
  assert.equal(validatePassword('a'.repeat(10)).ok, true);
  assert.equal(validatePassword('a'.repeat(64)).ok, true);
  assert.equal(validatePassword('a'.repeat(65)).ok, false);
  assert.equal(validatePassword('          ').ok, true, '공백도 글자로 센다');
  assert.equal(validatePassword('').ok, false);
  assert.equal(validatePassword('a'.repeat(9)).message, '비밀번호는 10~64자로 입력해 주세요.');
});

test('비밀번호 확인', () => {
  assert.equal(validatePasswordConfirm('abcdefghij', 'abcdefghij').ok, true);
  assert.equal(validatePasswordConfirm('abcdefghij', 'abcdefghiJ').ok, false);
  assert.equal(validatePasswordConfirm('abcdefghij', '').ok, false);
});

test('닉네임: 한글·영문·숫자 2~12자', () => {
  assert.equal(validateNickname('가').ok, false);
  assert.equal(validateNickname('가나').ok, true);
  assert.equal(validateNickname('개발유저').ok, true);
  assert.equal(validateNickname('a'.repeat(12)).ok, true);
  assert.equal(validateNickname('a'.repeat(13)).ok, false);
  assert.equal(validateNickname('닉네임 하나').ok, false, '공백 불가');
  assert.equal(validateNickname('닉네임!').ok, false, '기호 불가');
  assert.equal(validateNickname('ㄱㄴㄷ').ok, false, '자모만은 불가');
});

test('펫 별명: 한글·영문 2~10자 (숫자 불가)', () => {
  assert.equal(validatePetNickname('냥').ok, false);
  assert.equal(validatePetNickname('냥이').ok, true);
  assert.equal(validatePetNickname('꾸준냥이').ok, true);
  assert.equal(validatePetNickname('a'.repeat(10)).ok, true);
  assert.equal(validatePetNickname('a'.repeat(11)).ok, false);
  assert.equal(validatePetNickname('냥이1').ok, false, '숫자 불가');
});

test('인증번호: 숫자 6자리', () => {
  assert.equal(validateOtp('000000').ok, true);
  assert.equal(validateOtp('12345').ok, false);
  assert.equal(validateOtp('1234567').ok, false);
  assert.equal(validateOtp('12345a').ok, false);
});

// ── 11 §8.2 운동별 목표 범위 ───────────────────────────────────────────

test('운동 목표 범위: 11 §8.2 표의 경계값', () => {
  const cases = [
    ['push_up', 'reps', 1, 100],
    ['burpee', 'reps', 1, 50],
    ['squat', 'reps', 1, 200],
    ['lunge', 'reps', 2, 100],
    ['plank', 'seconds', 10, 90],
    ['running', 'meters', 500, 21000],
    ['running', 'seconds', 300, 7200],
  ];
  for (const [exerciseCode, targetUnit, min, max] of cases) {
    const ctx = { exerciseCode, targetUnit };
    assert.equal(validateTarget(min - 1, ctx).ok, false, `${exerciseCode} ${min - 1}`);
    assert.equal(validateTarget(min, ctx).ok, true, `${exerciseCode} ${min}`);
    assert.equal(validateTarget(max, ctx).ok, true, `${exerciseCode} ${max}`);
    assert.equal(validateTarget(max + 1, ctx).ok, false, `${exerciseCode} ${max + 1}`);
  }
});

test('운동 목표: 정수가 아니거나 단위가 안 맞으면 거절', () => {
  assert.equal(validateTarget('스무개', { exerciseCode: 'squat', targetUnit: 'reps' }).ok, false);
  assert.equal(validateTarget(20.5, { exerciseCode: 'squat', targetUnit: 'reps' }).ok, false);
  assert.equal(validateTarget(20, { exerciseCode: 'squat', targetUnit: 'meters' }).ok, false);
  assert.equal(validateTarget(20, { exerciseCode: 'swimming', targetUnit: 'meters' }).ok, false);
});

test('운동이 아닌 미션은 1 이상이면 된다', () => {
  assert.equal(validateTarget(0, {}).ok, false);
  assert.equal(validateTarget(1, {}).ok, true);
  assert.equal(validateTarget(99999, { exerciseCode: null }).ok, true);
});

// ── 11 §8.4 길이 ──────────────────────────────────────────────────────

test('11 §8.4 길이 경계값', () => {
  assert.equal(validateLength('', 'goalTitle').ok, false);
  assert.equal(validateLength('a', 'goalTitle').ok, true);
  assert.equal(validateLength('a'.repeat(200), 'goalTitle').ok, true);
  assert.equal(validateLength('a'.repeat(201), 'goalTitle').ok, false);

  assert.equal(validateLength('', 'goalDescription').ok, true, '설명은 비워도 됨');
  assert.equal(validateLength('a'.repeat(1000), 'goalDescription').ok, true);
  assert.equal(validateLength('a'.repeat(1001), 'goalDescription').ok, false);

  assert.equal(validateLength('a'.repeat(9), 'appealReason').ok, false);
  assert.equal(validateLength('a'.repeat(10), 'appealReason').ok, true);
  assert.equal(validateLength('a'.repeat(500), 'appealReason').ok, true);
  assert.equal(validateLength('a'.repeat(501), 'appealReason').ok, false);

  assert.equal(validateLength('a'.repeat(30), 'challengeTitle').ok, true);
  assert.equal(validateLength('a'.repeat(31), 'challengeTitle').ok, false);
  assert.equal(validateLength('a'.repeat(2000), 'supportBody').ok, true);
  assert.equal(validateLength('a'.repeat(2001), 'supportBody').ok, false);
});

test('기간: 종료일이 시작일보다 앞서면 거절', () => {
  assert.equal(validatePeriod('2026-11-01', '2026-11-30').ok, true);
  assert.equal(validatePeriod('2026-11-01', '2026-11-01').ok, true);
  assert.equal(validatePeriod('2026-11-02', '2026-11-01').ok, false);
  assert.equal(validatePeriod('', '2026-11-01').ok, false);
});

// ── MC-04 표시 서식 ────────────────────────────────────────────────────

test('formatDate / formatTime: KST 고정', () => {
  assert.equal(formatDate('2026-11-04'), '11월 4일 (수)');
  assert.equal(formatDate('2026-11-04', { withYear: true }), '2026년 11월 4일 (수)');
  // UTC 2026-11-04T15:30Z = KST 2026-11-05 00:30 → 날짜가 넘어간다
  assert.equal(formatDate('2026-11-04T15:30:00.000Z'), '11월 5일 (목)');
  assert.equal(formatTime('2026-11-04T05:15:00.000Z'), '오후 2:15');
  assert.equal(formatTime('2026-11-04T00:05:00.000Z'), '오전 9:05');
  assert.equal(formatTime('2026-11-04T03:00:00.000Z'), '오후 12:00');
  assert.equal(formatDate('나쁜 값'), '');
});

test('toDateString / todayKst', () => {
  assert.equal(toDateString('2026-11-04T15:30:00.000Z'), '2026-11-05');
  assert.equal(toDateString('2026-11-04'), '2026-11-04');
  assert.equal(todayKst(Date.parse('2026-11-04T14:59:59.000Z')), '2026-11-04');
  assert.equal(todayKst(Date.parse('2026-11-04T15:00:00.000Z')), '2026-11-05');
});

test('formatDuration: 25:20 · 1:05:00', () => {
  assert.equal(formatDuration(1520), '25:20');
  assert.equal(formatDuration(3900), '1:05:00');
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(59), '0:59');
  assert.equal(formatDuration(303), '5:03');
  assert.equal(formatDuration(7200), '2:00:00');
});

test('formatDistance: 850m · 3.12km', () => {
  assert.equal(formatDistance(850), '850m');
  assert.equal(formatDistance(999), '999m');
  assert.equal(formatDistance(1000), '1km');
  assert.equal(formatDistance(3120.5), '3.12km');
  assert.equal(formatDistance(3200), '3.2km');
  assert.equal(formatDistance(21000), '21km');
});

test('formatPoints · formatRate', () => {
  assert.equal(formatPoints(1250), '1,250P');
  assert.equal(formatPoints(0), '0P');
  assert.equal(formatPoints(-300), '-300P');
  assert.equal(formatRate(0.72), '72%');
  assert.equal(formatRate(0.7213), '72%');
  assert.equal(formatRate(0.7213, { digits: 2 }), '72.13%');
  assert.equal(formatRate(1), '100%');
});

test('formatTarget: 04 §6 단위별 표시', () => {
  assert.equal(formatTarget(20, 'reps'), '20회');
  assert.equal(formatTarget(90, 'seconds'), '1분 30초');
  assert.equal(formatTarget(21600, 'seconds'), '6시간');
  assert.equal(formatTarget(3200, 'meters'), '3.2km');
  assert.equal(formatTarget(8000, 'steps'), '8,000걸음');
  assert.equal(formatTarget(20, 'pages'), '20쪽');
  assert.equal(formatTarget(4, 'times'), '4회');
  assert.equal(formatTarget(5, 'days'), '5일');
  assert.equal(formatSpokenDuration(0), '0초');
  assert.equal(formatSpokenDuration(3661), '1시간 1분 1초');
});
