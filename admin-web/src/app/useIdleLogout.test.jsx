import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleLogout } from './useIdleLogout.js';

const MINUTE = 60 * 1000;

describe('useIdleLogout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls onIdle once after the limit without activity', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout({ limitMs: 10 * MINUTE, onIdle }));
    vi.advanceTimersByTime(9 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('activity starts the wait again', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout({ limitMs: 10 * MINUTE, onIdle }));
    vi.advanceTimersByTime(8 * MINUTE);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(8 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled and stops after unmount', () => {
    const disabled = vi.fn();
    renderHook(() => useIdleLogout({ limitMs: MINUTE, onIdle: disabled, enabled: false }));
    const removed = vi.fn();
    const { unmount } = renderHook(() => useIdleLogout({ limitMs: MINUTE, onIdle: removed }));
    unmount();
    vi.advanceTimersByTime(10 * MINUTE);
    expect(disabled).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
  });

  it('checks again when a sleeping tab becomes visible', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout({ limitMs: 10 * MINUTE, onIdle }));
    // the browser pauses timers while the computer sleeps: only the clock moves
    vi.setSystemTime(Date.now() + 60 * MINUTE);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
