import test from 'node:test';
import assert from 'node:assert/strict';

import labels, { labelOf } from '../src/client/labels.js';

/**
 * 04 §5 표에서 **한국어 문구가 적혀 있는** 상태값 묶음 전부.
 * (문구가 없는 묶음 — media_kind·upload_status·point source_type·push_status·
 *  run_type·condition_type — 은 labels.js에도 넣지 않았다. 그 사유는 labels.js 머리글.)
 */
const EXPECTED = {
  goalStatus: ['active', 'paused', 'completed'],
  goalStepStatus: ['active', 'completed'],
  missionStatus: ['scheduled', 'in_progress', 'submitted', 'completed', 'failed', 'cancelled'],
  missionSourceType: ['user', 'template', 'ai', 'challenge'],
  missionCancelReason: ['user_cancelled', 'goal_deleted', 'plan_adjusted', 'challenge_withdrawn', 'challenge_cancelled'],
  missionDefinitionPublicationStatus: ['draft', 'private', 'review_pending', 'public', 'rejected', 'hidden'],
  planProposalStatus: ['draft', 'accepted', 'rejected', 'expired'],
  planAdjustmentStatus: ['proposed', 'accepted', 'rejected', 'expired'],
  recordStatus: ['recording', 'uploading', 'submitted', 'review_required', 'approved', 'rejected', 'superseded', 'aborted'],
  evidenceKind: ['camera_media', 'sensor_raw', 'sensor_summary'],
  decision: ['approved', 'rejected', 'review_required'],
  decisionSource: ['ai', 'admin'],
  appealStatus: ['open', 'accepted', 'rejected'],
  pointTransactionKind: [
    'auto_award', 'spend', 'refund', 'manual_grant', 'manual_recovery', 'recovery',
    'recovery_claim', 'recovery_settlement', 'recovery_cancel', 'reinstatement',
    'award_offset', 'refund_offset',
  ],
  streakDayStatus: ['pending', 'success', 'failed'],
  achievementRarity: ['common', 'rare', 'legendary'],
  petStageCode: ['egg', 'baby', 'adult'],
  shopItemKind: ['consumable', 'permanent'],
  shopOrderStatus: ['completed', 'cancelled'],
  challengePublicationStatus: ['draft', 'review_pending', 'public', 'rejected', 'hidden', 'cancelled'],
  challengeSettlementStatus: ['not_started', 'draft', 'confirmed'],
  challengeParticipationStatus: ['enrolled', 'withdrawn', 'disqualified', 'completed', 'failed'],
  challengeDailyMissionStatus: ['pending', 'success', 'failed', 'excluded', 'cancelled'],
  userStatus: ['active', 'withdrawal_processing'],
  accountActionType: ['warning', 'restriction'],
  withdrawalStatus: ['requested', 'cancelled', 'on_hold', 'processing', 'completed'],
  ticketType: ['inquiry', 'report'],
  ticketStatus: ['received', 'in_review', 'completed'],
  ticketTargetKind: ['user', 'mission_definition', 'challenge'],
  ticketOutcome: ['no_action', 'reply_only', 'account_action', 'content_action', 'both'],
  noticeCategory: ['service', 'event', 'policy', 'marketing'],
  noticeStatus: ['draft', 'scheduled', 'published', 'cancelled'],
  recommendationStatus: ['shown', 'accepted', 'dismissed', 'expired'],
  // 04 §4 운동 종류, 04 §6 단위
  exerciseCode: ['push_up', 'burpee', 'squat', 'lunge', 'plank', 'running'],
  targetUnit: ['reps', 'seconds', 'meters', 'steps', 'pages', 'times', 'days'],
};

test('04 §5 표의 모든 상태값에 문구가 있다', () => {
  for (const [group, codes] of Object.entries(EXPECTED)) {
    const table = labels[group];
    assert.ok(table, `labels.${group}이(가) 없어요`);
    for (const code of codes) {
      const text = table[code];
      assert.equal(typeof text, 'string', `labels.${group}.${code}`);
      assert.ok(text.length > 0, `labels.${group}.${code}이(가) 비었어요`);
    }
  }
});

test('04 §5에 없는 값이 섞여 있지 않다', () => {
  for (const [group, codes] of Object.entries(EXPECTED)) {
    assert.deepEqual([...Object.keys(labels[group])].sort(), [...codes].sort(), group);
  }
});

test('labels에 EXPECTED 밖의 묶음을 몰래 늘리지 않았다', () => {
  assert.deepEqual(Object.keys(labels).sort(), Object.keys(EXPECTED).sort());
});

test('parts/mobile-client §4.2의 사용 예', () => {
  assert.equal(labels.missionStatus.completed, '완료');
});

test('review_required는 "검토 중" — 성공 문구가 아니다 (04 §5)', () => {
  assert.equal(labels.recordStatus.review_required, '검토 중');
  assert.equal(labels.recordStatus.approved, '인증 성공');
  assert.equal(labels.decision.review_required, '검토 필요');
});

test('labelOf: 모르는 값은 값 그대로, 빈 값은 빈 문자열', () => {
  assert.equal(labelOf('missionStatus', 'completed'), '완료');
  assert.equal(labelOf('missionStatus', 'who_knows'), 'who_knows');
  assert.equal(labelOf('nope', 'completed'), 'completed');
  assert.equal(labelOf('missionStatus', null), '');
  assert.equal(labelOf('missionStatus', undefined), '');
});
