import { randomUUID } from 'node:crypto';
import { parseCallback } from '../../../src/verification/ai/ai-ingest.controller.js';
import {
  pickMedia,
  toVisionAnalysisRequest,
  UnsendableError,
} from '../../../src/verification/ai/vision-contract.js';

const CALLBACK = 'http://localhost:3000/internal/v1/ai-callbacks';
const SHA = 'AB'.repeat(32);

function internalRequest(overrides = {}) {
  return {
    recordId: randomUUID(),
    missionId: randomUUID(),
    userId: randomUUID(),
    verificationMethod: 'camera',
    submissionNo: 2,
    categoryCode: 'exercise',
    exerciseCode: 'squat',
    targetValue: '20.00',
    targetUnit: 'reps',
    recordStartedAt: new Date('2026-11-09T01:00:00Z'),
    submittedAt: '2026-11-09T01:05:00.000Z',
    criteria: { versionId: randomUUID(), versionNo: 3, rules: { minReps: 5 } },
    files: [
      {
        id: randomUUID(),
        mediaKind: 'camera_video',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
        url: 'https://signed.example/x',
        objectKey: 'dev/users/u/records/r/m.mp4',
        checksumSha256: SHA,
      },
    ],
    ...overrides,
  };
}

describe('toVisionAnalysisRequest', () => {
  it('AI 계약 모양(VisionAnalysisRequest)으로 바꿈', () => {
    const request = internalRequest();
    const wire = toVisionAnalysisRequest(request, CALLBACK);
    expect(wire).toEqual({
      ingestKey: `vision:${request.recordId}:2`,
      recordId: request.recordId,
      missionId: request.missionId,
      submissionNo: 2,
      categoryCode: 'exercise',
      exerciseCode: 'squat',
      targetValue: 20,
      targetUnit: 'reps',
      media: [
        {
          mediaId: request.files[0].id,
          objectKey: 'dev/users/u/records/r/m.mp4',
          mimeType: 'video/mp4',
          mediaKind: 'camera_video',
          sizeBytes: 1024,
          checksumSha256: SHA.toLowerCase(),
        },
      ],
      recordStartedAt: '2026-11-09T01:00:00.000Z',
      submittedAt: '2026-11-09T01:05:00.000Z',
      duplicateOfMediaId: null,
      criteria: {
        versionId: request.criteria.versionId,
        rules: { minReps: 5 },
      },
      callbackUrl: CALLBACK,
    });
    // 내부용 필드(userId, 서명 URL)는 AI로 보내지 않음
    expect(JSON.stringify(wire)).not.toContain('signed.example');
    expect(wire).not.toHaveProperty('userId');
  });

  it('미디어는 하나만: 영상이 있으면 영상, 없으면 사진', () => {
    const video = internalRequest().files[0];
    const photo = {
      ...video,
      id: randomUUID(),
      mediaKind: 'camera_photo',
      mimeType: 'image/jpeg',
    };
    expect(pickMedia([photo, video]).mediaKind).toBe('camera_video');
    expect(pickMedia([photo]).mediaKind).toBe('camera_photo');
    expect(pickMedia([])).toBeNull();

    const wire = toVisionAnalysisRequest(
      internalRequest({
        files: [photo, video, { ...photo, id: randomUUID() }],
      }),
      CALLBACK,
    );
    expect(wire.media).toHaveLength(1);
    expect(wire.media[0].mediaKind).toBe('camera_video');
  });

  it('사진 인증은 exerciseCode가 null', () => {
    const photo = {
      ...internalRequest().files[0],
      mediaKind: 'camera_photo',
      mimeType: 'image/jpeg',
    };
    const wire = toVisionAnalysisRequest(
      internalRequest({ files: [photo] }),
      CALLBACK,
    );
    expect(wire.exerciseCode).toBeNull();
  });

  it('목표값·단위가 없거나 허용 밖이면 1 times로 보냄', () => {
    const wire = toVisionAnalysisRequest(
      internalRequest({ targetValue: null, targetUnit: '개' }),
      CALLBACK,
    );
    expect(wire).toMatchObject({ targetValue: 1, targetUnit: 'times' });
  });

  it.each([
    ['센서 인증', { verificationMethod: 'sensor' }],
    ['파일 없음', { files: [] }],
    [
      '저장소 키 없음',
      { files: [{ ...internalRequest().files[0], objectKey: null }] },
    ],
    [
      '체크섬 없음',
      { files: [{ ...internalRequest().files[0], checksumSha256: null }] },
    ],
    ['판정 기준 없음', { criteria: null }],
    ['영상인데 운동 종류 없음', { exerciseCode: null }],
  ])('보낼 수 없는 회차(%s)는 영구 실패', (_name, overrides) => {
    const error = (() => {
      try {
        toVisionAnalysisRequest(internalRequest(overrides), CALLBACK);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(UnsendableError);
    expect(error.permanent).toBe(true);
  });
});

describe('parseCallback', () => {
  const base = {
    ingestKey: 'vision:abc:1',
    recordId: randomUUID(),
    engineVersion: 'vision-rule@0.1.0',
  };

  it('완료 콜백은 decision 필수, rawResult가 없으면 본문 전체를 저장', () => {
    const body = {
      ...base,
      status: 'completed',
      decision: 'review_required',
      reason: '수동 검토 필요',
      metrics: { exerciseCode: 'squat', repCount: 12, flags: [] },
    };
    const parsed = parseCallback(body);
    expect(parsed).toMatchObject({
      status: 'completed',
      decision: 'review_required',
    });
    expect(parsed.rawResult).toEqual(body);
    expect(() => parseCallback({ ...base, status: 'completed' })).toThrow();
    expect(() => parseCallback({ ...base })).toThrow();
  });

  it('실패 콜백은 decision 없이 failureReason만', () => {
    const parsed = parseCallback({
      ...base,
      status: 'failed',
      failureReason: 'AI_VIDEO_ANALYSIS_FAILED',
    });
    expect(parsed).toMatchObject({
      status: 'failed',
      failureReason: 'AI_VIDEO_ANALYSIS_FAILED',
    });
    expect(parsed.decision).toBeUndefined();
  });

  it('기존 형식(status 없이 decision+rawResult)도 받음', () => {
    const parsed = parseCallback({
      ...base,
      decision: 'approved',
      rawResult: { any: 1 },
    });
    expect(parsed.rawResult).toEqual({ any: 1 });
  });

  it('형식이 틀리면 거절', () => {
    expect(() =>
      parseCallback({ ...base, status: 'done', decision: 'approved' }),
    ).toThrow();
    expect(() =>
      parseCallback({ ...base, recordId: 'x', decision: 'approved' }),
    ).toThrow();
  });
});

describe('toVisionAnalysisRequest 파일 접근 방식', () => {
  it('기본(object_key)은 서명 URL을 보내지 않고, signed_url이면 downloadUrl을 더함', () => {
    const request = internalRequest();
    const byKey = toVisionAnalysisRequest(request, CALLBACK);
    expect(byKey.media[0]).not.toHaveProperty('downloadUrl');
    const bySigned = toVisionAnalysisRequest(request, CALLBACK, {
      mediaAccess: 'signed_url',
    });
    expect(bySigned.media[0].downloadUrl).toBe('https://signed.example/x');
    expect(bySigned.media[0].objectKey).toBe(request.files[0].objectKey);
  });
});
