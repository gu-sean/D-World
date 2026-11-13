import { newId } from '../../../src/common/ids.js';
import {
  sensorResponseToDecisionInput,
  toSensorEvaluationRequest,
} from '../../../src/verification/ai/sensor-contract.js';
import { UnsendableError } from '../../../src/verification/ai/vision-contract.js';

const SHA = 'AB'.repeat(32);

function runRequest(overrides = {}) {
  return {
    recordId: newId(),
    missionId: newId(),
    verificationMethod: 'sensor',
    submissionNo: 1,
    exerciseCode: 'running',
    targetValue: '3000.00',
    targetUnit: 'meters',
    recordStartedAt: new Date('2026-11-09T01:00:00Z'),
    submittedAt: '2026-11-09T01:40:00.000Z',
    metrics: {
      distanceMeters: 3100,
      steps: 4000,
      appVersion: '1.2.0',
      extra: 1,
    },
    criteria: { versionId: newId(), rules: { minDurationSeconds: 300 } },
    files: [
      {
        id: newId(),
        mediaKind: 'sensor_raw',
        mimeType: 'application/gzip',
        sizeBytes: 2048,
        url: 'https://signed.example/run',
        objectKey: 'dev/records/r/run.json.gz',
        checksumSha256: SHA,
      },
    ],
    ...overrides,
  };
}

describe('I02 센서 판정 요청', () => {
  it('AI 계약 본문: 파일 키·체크섬, 앱 지표는 계약에 있는 키만, 서명 URL은 기본 미포함', () => {
    const request = runRequest();
    const wire = toSensorEvaluationRequest(request);
    expect(wire).toEqual({
      ingestKey: `sensor:${request.recordId}:1`,
      recordId: request.recordId,
      exerciseCode: 'running',
      targetValue: 3000,
      targetUnit: 'meters',
      recordStartedAt: '2026-11-09T01:00:00.000Z',
      submittedAt: '2026-11-09T01:40:00.000Z',
      media: [
        {
          mediaId: request.files[0].id,
          objectKey: 'dev/records/r/run.json.gz',
          mimeType: 'application/gzip',
          mediaKind: 'sensor_raw',
          sizeBytes: 2048,
          checksumSha256: SHA.toLowerCase(),
        },
      ],
      clientMetrics: { distanceMeters: 3100, steps: 4000, appVersion: '1.2.0' },
      duplicateOfMediaId: null,
      criteria: {
        versionId: request.criteria.versionId,
        rules: { minDurationSeconds: 300 },
      },
    });
    expect(JSON.stringify(wire)).not.toContain('signed.example');
  });

  it('앱 지표가 없으면 clientMetrics는 null, appVersion이 없으면 unknown', () => {
    expect(
      toSensorEvaluationRequest(runRequest({ metrics: null })).clientMetrics,
    ).toBeNull();
    expect(
      toSensorEvaluationRequest(runRequest({ metrics: { steps: 10 } }))
        .clientMetrics,
    ).toEqual({ steps: 10, appVersion: 'unknown' });
  });

  it.each([
    ['센서 인증이 아님', { verificationMethod: 'camera' }],
    ['러닝이 아님', { exerciseCode: 'squat' }],
    ['파일 없음', { files: [] }],
    ['목표 단위 오류', { targetUnit: 'reps' }],
    ['목표값 없음', { targetValue: null }],
    ['판정 기준 없음', { criteria: null }],
  ])('보낼 수 없는 회차: %s', (_label, overrides) => {
    expect(() => toSensorEvaluationRequest(runRequest(overrides))).toThrow(
      UnsendableError,
    );
  });

  it('AI 응답을 콜백 입력으로 바꾸고, 계약과 다르면 거부', () => {
    const recordId = newId();
    const response = {
      ingestKey: `sensor:${recordId}:1`,
      decision: 'review_required',
      confidence: 0,
      reason: '개발용 규칙 결과',
      engineVersion: 'sensor-run-dev@0.1.0',
      metrics: { exerciseCode: 'running', flags: [] },
    };
    expect(sensorResponseToDecisionInput(recordId, response)).toMatchObject({
      recordId,
      decision: 'review_required',
      status: 'completed',
      engineVersion: 'sensor-run-dev@0.1.0',
    });
    expect(() =>
      sensorResponseToDecisionInput(recordId, {
        ...response,
        decision: 'maybe',
      }),
    ).toThrow();
    expect(() => sensorResponseToDecisionInput(recordId, null)).toThrow();
  });
});
