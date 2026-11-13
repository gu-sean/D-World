// 덤프 복원 직후 시험 계정의 날짜를 "복원한 날"에 맞춘다 (demo.mjs가 사용)
//
// 시연 덤프는 DUMP_ANCHOR_DATE를 "오늘"로 만들었다. 다른 날 복원하면 홈의 오늘 미션이 비고 연속 기록이 과거로 보여서,
// 시험 계정 한 명의 목표·미션·기록·판정·연속 기록 날짜를 (오늘 − 기준일)만큼 하루 단위로 옮긴다.
// 원장(포인트·경험치)·정산·다른 시연 사용자·AI 리포트는 과거 기록이라 그대로 둔다.
// 날짜가 키인 표는 겹치지 않게 두 번에 나눠 옮기고, 해당 표의 사용자 트리거만 잠시 끈다(표 소유자 권한이면 충분)

export const DUMP_ANCHOR_DATE = '2026-11-12';

/** 한국 시간 기준 오늘 날짜 */
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 두 날짜(YYYY-MM-DD) 사이 일수 (to - from) */
export function daysBetween(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** delta일만큼 옮기는 SQL. delta가 0이면 빈 문자열 */
export function alignDatesSql(phone, delta) {
  if (!Number.isInteger(delta)) throw new Error('delta는 정수여야 해요');
  if (delta === 0) return '';
  const user = `(SELECT user_id FROM phone_credentials WHERE phone_e164 = '${phone}')`;
  const goals = `(SELECT id FROM goals WHERE user_id = ${user})`;
  const records = `(SELECT id FROM mission_records WHERE user_id = ${user})`;
  const tables = [
    'goals',
    'goal_steps',
    'missions',
    'mission_records',
    'verification_results',
    'streak_days',
    'streak_states',
  ];
  const day = (col, n) => `${col} = ${col} + ${n}`;
  const ts = (col, n) => `${col} = ${col} + make_interval(days => ${n})`;
  // 첫 번째에 +100000, 두 번째에 -100000+delta
  const twoPass = (table, set, where) =>
    [100000, -100000 + delta]
      .map((n) => `UPDATE ${table} SET ${set(n)} WHERE ${where};`)
      .join('\n');

  return [
    'BEGIN;',
    ...tables.map((t) => `ALTER TABLE ${t} DISABLE TRIGGER USER;`),
    twoPass('streak_days', (n) => day('streak_date', n), `user_id = ${user}`),
    twoPass(
      'missions',
      (n) =>
        [
          day('scheduled_date', n),
          ts('due_at', n),
          ts('created_at', n),
          ts('updated_at', n),
        ].join(', '),
      `user_id = ${user}`,
    ),
    twoPass('goal_steps', (n) => day('due_date', n), `goal_id IN ${goals}`),
    twoPass(
      'goals',
      (n) =>
        [
          day('start_date', n),
          day('end_date', n),
          ts('created_at', n),
          ts('updated_at', n),
        ].join(', '),
      `user_id = ${user}`,
    ),
    `UPDATE mission_records SET ${[ts('started_at', delta), ts('submitted_at', delta), ts('completed_at', delta)].join(', ')} WHERE id IN ${records};`,
    `UPDATE verification_results SET ${[ts('decided_at', delta), ts('notified_at', delta)].join(', ')} WHERE record_id IN ${records};`,
    `UPDATE streak_states SET ${day('last_success_date', delta)} WHERE user_id = ${user};`,
    'SET CONSTRAINTS ALL IMMEDIATE;', // 대기 중인 제약 검사를 먼저 끝내야 트리거를 다시 켤 수 있음
    ...tables.map((t) => `ALTER TABLE ${t} ENABLE TRIGGER USER;`),
    'COMMIT;',
    '',
  ].join('\n');
}

/**
 * 시드 공개 챌린지(참가자 없음)를 "오늘+2일 시작, 오늘+8일 종료"로 다시 맞춘다.
 * 시드는 만든 날 기준이라 며칠 뒤 복원하면 이미 끝난 챌린지가 되기 때문이다. 참가자가 있으면 건드리지 않는다.
 */
export const SEED_CHALLENGE_ID = 'd0000000-0000-4000-8000-000000000701';
export function alignSeedChallengeSql() {
  const today = "(now() AT TIME ZONE 'Asia/Seoul')::date";
  return [
    'BEGIN;',
    'ALTER TABLE challenges DISABLE TRIGGER USER;',
    `UPDATE challenges SET start_date = ${today} + 2, end_date = ${today} + 8
      WHERE id = '${SEED_CHALLENGE_ID}' AND publication_status = 'public'
        AND NOT EXISTS (SELECT 1 FROM challenge_participations WHERE challenge_id = '${SEED_CHALLENGE_ID}');`,
    'SET CONSTRAINTS ALL IMMEDIATE;',
    'ALTER TABLE challenges ENABLE TRIGGER USER;',
    'COMMIT;',
    '',
  ].join('\n');
}
