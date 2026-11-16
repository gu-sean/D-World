/**
 * 영상 제출 대기열 규칙: 보관 → 올리기 → 지우기, 일시 실패는 다시, 영구 실패·7일 경과는 포기.
 * 파일·네트워크는 가짜로 바꿔 시간(now)을 직접 움직인다.
 */
import {
  createSubmissionQueue,
  isTransientFailure,
  backoffMs,
  MAX_AGE_MS,
  MAX_ITEMS,
} from '../submissionQueueCore.js';

function setup(overrides = {}) {
  let text = null;
  const removed = [];
  const clock = { t: 1_000_000 };
  const calls = { upload: [], submit: [] };
  const deps = {
    storage: {
      read: async () => text,
      write: async (value) => {
        text = value;
      },
    },
    files: {
      persist: async (path, name) => `/keep/${name}`,
      remove: async (path) => {
        removed.push(path);
      },
    },
    upload: jest.fn(async (item) => calls.upload.push(item.recordId)),
    submit: jest.fn(async (item) => calls.submit.push(item.recordId)),
    getUserId: () => 'u1',
    now: () => clock.t,
    ...overrides,
  };
  const queue = createSubmissionQueue(deps);
  const events = [];
  queue.onEvent((e) => events.push(e));
  return { queue, deps, removed, clock, calls, events, stored: () => JSON.parse(text ?? '[]') };
}

const file = { path: '/cache/a.mp4', mediaKind: 'camera_video', mimeType: 'video/mp4', sizeBytes: 10, checksumSha256: 'x' };
const entry = (recordId = 'r1') => ({ recordId, missionId: 'm1', file, keys: { upload: 'ku', submit: 'ks' }, appVersion: '1.0' });
const netError = () => Object.assign(new Error('net'), { code: 'NETWORK_ERROR', status: 0, isNetwork: true });
const rejected = () => Object.assign(new Error('expired'), { code: 'mission_expired', status: 409 });

describe('isTransientFailure', () => {
  it('네트워크·업로드 실패·5xx·429는 다시 시도할 실패', () => {
    expect(isTransientFailure(netError())).toBe(true);
    expect(isTransientFailure({ code: 'UPLOAD_FAILED', status: 0 })).toBe(true);
    expect(isTransientFailure({ code: 'COMMON_INTERNAL', status: 503 })).toBe(true);
    expect(isTransientFailure({ code: 'RATE', status: 429 })).toBe(true);
  });
  it('4xx(마감·권한 등)는 영구 실패', () => {
    expect(isTransientFailure(rejected())).toBe(false);
    expect(isTransientFailure({ code: 'x', status: 404 })).toBe(false);
    expect(isTransientFailure(null)).toBe(false);
  });
  it('백오프는 늘다가 마지막 값에서 멈춘다', () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(99)).toBe(3_600_000);
  });
});

describe('보관과 삭제', () => {
  it('add는 파일을 보관 폴더로 옮겨 항목을 저장한다', async () => {
    const { queue, stored } = setup();
    const item = await queue.add(entry());
    expect(item.file.path).toBe('/keep/r1.mp4');
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ recordId: 'r1', userId: 'u1', uploaded: false, attempts: 0 });
  });

  it('complete는 항목과 기기의 영상을 지운다', async () => {
    const { queue, stored, removed } = setup();
    await queue.add(entry());
    await queue.complete('r1');
    expect(stored()).toHaveLength(0);
    expect(removed).toEqual(['/keep/r1.mp4']);
  });

  it('활성(화면 흐름이 올리는 중)인 항목은 flush가 건드리지 않는다', async () => {
    const { queue, deps } = setup();
    await queue.add(entry());
    const summary = await queue.flush();
    expect(deps.upload).not.toHaveBeenCalled();
    expect(summary).toEqual({ sent: 0, retry: 0, dropped: 0 });
  });

  it('보관 개수를 넘으면 가장 오래된 항목을 밀어낸다', async () => {
    const { queue, stored, removed } = setup();
    for (let i = 0; i <= MAX_ITEMS; i += 1) await queue.add(entry(`r${i}`));
    expect(stored()).toHaveLength(MAX_ITEMS);
    expect(removed).toContain('/keep/r0.mp4');
  });
});

describe('flush', () => {
  it('release한 항목은 백오프가 지난 뒤 올리고 제출하고 지운다', async () => {
    const { queue, clock, calls, stored, removed, events } = setup();
    await queue.add(entry());
    await queue.release('r1'); // 시도 1회 → 60초 뒤
    expect((await queue.flush()).sent).toBe(0); // 아직 이르다
    clock.t += 60_000;
    const summary = await queue.flush();
    expect(summary.sent).toBe(1);
    expect(calls.upload).toEqual(['r1']);
    expect(calls.submit).toEqual(['r1']);
    expect(stored()).toHaveLength(0);
    expect(removed).toEqual(['/keep/r1.mp4']);
    expect(events.map((e) => e.type)).toEqual(['queued', 'submitted']);
  });

  it('이미 올라간 항목은 다시 올리지 않고 제출만 한다', async () => {
    const { queue, clock, calls } = setup();
    await queue.add(entry());
    await queue.markUploaded('r1');
    await queue.release('r1');
    clock.t += 60_000;
    await queue.flush();
    expect(calls.upload).toEqual([]);
    expect(calls.submit).toEqual(['r1']);
  });

  it('일시 실패면 항목을 남기고 더 긴 간격으로 다시 시도한다', async () => {
    const { queue, clock, deps, stored } = setup();
    deps.upload.mockRejectedValueOnce(netError());
    await queue.add(entry());
    await queue.release('r1');
    clock.t += 60_000;
    expect((await queue.flush()).retry).toBe(1);
    expect(stored()[0].attempts).toBe(2);
    expect(await queue.nextDelayMs()).toBe(120_000);
    clock.t += 120_000;
    expect((await queue.flush()).sent).toBe(1);
  });

  it('영구 실패(4xx)면 항목과 영상을 지우고 알린다', async () => {
    const { queue, clock, deps, stored, removed, events } = setup();
    deps.submit.mockRejectedValueOnce(rejected());
    await queue.add(entry());
    await queue.release('r1');
    clock.t += 60_000;
    expect((await queue.flush()).dropped).toBe(1);
    expect(stored()).toHaveLength(0);
    expect(removed).toEqual(['/keep/r1.mp4']);
    expect(events.at(-1)).toMatchObject({ type: 'dropped', reason: 'rejected' });
  });

  it('7일이 지나면 포기하고 알린다', async () => {
    const { queue, clock, deps, events } = setup();
    await queue.add(entry());
    await queue.release('r1');
    clock.t += MAX_AGE_MS + 1;
    await queue.flush();
    expect(deps.upload).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: 'dropped', reason: 'expired' });
  });

  it('로그인하지 않았거나 다른 회원의 항목은 올리지 않는다', async () => {
    const state = { user: 'u1' };
    const { queue, clock, deps } = setup({ getUserId: () => state.user });
    await queue.add(entry());
    await queue.release('r1');
    clock.t += 60_000;
    state.user = 'u2';
    await queue.flush();
    state.user = null;
    await queue.flush();
    expect(deps.upload).not.toHaveBeenCalled();
    state.user = 'u1';
    expect((await queue.flush()).sent).toBe(1);
  });

  it('flush는 동시에 한 번만 돈다', async () => {
    const { queue, clock, deps } = setup();
    await queue.add(entry());
    await queue.release('r1');
    clock.t += 60_000;
    await Promise.all([queue.flush(), queue.flush()]);
    expect(deps.upload).toHaveBeenCalledTimes(1);
  });

  it('앱을 다시 켠 뒤(활성 목록이 비었을 때) 저장된 항목을 이어서 올린다', async () => {
    const first = setup();
    await first.queue.add(entry());
    const saved = JSON.stringify(first.stored());
    const second = setup({ storage: { read: async () => saved, write: async () => {} } });
    const summary = await second.queue.flush();
    expect(summary.sent).toBe(1);
  });
});
