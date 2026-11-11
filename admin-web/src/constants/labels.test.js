import * as enumModules from './enums.js';
import { labels } from './labels.js';

// antd Tag colors that labels.js may use.
const COLORS = ['default', 'processing', 'success', 'warning', 'error', 'blue', 'purple', 'gold'];

const { statusEnums } = enumModules;

describe('labels', () => {
  const kinds = Object.keys(statusEnums);

  test('every kind of enums.js has labels, and labels has no other kind', () => {
    expect(Object.keys(labels).sort()).toEqual([...kinds].sort());
  });

  test.each(kinds)('%s: every status value has { text, color } and nothing else', (kind) => {
    const values = Object.values(statusEnums[kind]);
    expect(Object.keys(labels[kind]).sort()).toEqual([...values].sort());
    for (const value of values) {
      const { text, color } = labels[kind][value];
      expect(typeof text).toBe('string');
      expect(text.trim()).not.toBe('');
      expect(COLORS).toContain(color);
    }
  });

  test('enum keys are the UPPER_SNAKE form of their values', () => {
    for (const kind of kinds) {
      for (const [key, value] of Object.entries(statusEnums[kind])) {
        expect(key).toBe(value.toUpperCase());
      }
    }
  });

  test('every exported enum object is listed in statusEnums', () => {
    const exported = Object.entries(enumModules).filter(([name]) => name !== 'statusEnums');
    const listed = Object.values(statusEnums);
    for (const [name, object] of exported) {
      expect(listed, name).toContain(object);
    }
  });

  test('texts of the main fields follow docs/04 §5', () => {
    expect(labels.missionStatus.in_progress.text).toBe('진행 중');
    expect(labels.recordStatus.approved.text).toBe('인증 성공');
    expect(labels.decision.review_required.text).toBe('검토 필요');
    expect(labels.userStatus.withdrawal_processing.text).toBe('탈퇴 처리 중');
  });

  test('review_required is shown as "검토 중" and is never green (not a success)', () => {
    expect(labels.recordStatus.review_required.text).toBe('검토 중');
    expect(labels.recordStatus.review_required.color).not.toBe('success');
    expect(labels.decision.review_required.color).not.toBe('success');
  });
});
