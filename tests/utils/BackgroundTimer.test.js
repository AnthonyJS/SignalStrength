import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundTimer } from '../../js/utils/BackgroundTimer.js';

// jsdom has no Worker, so these tests exercise the setInterval fallback path.
describe('BackgroundTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the callback on the given interval', () => {
    const timer = new BackgroundTimer();
    const callback = vi.fn();

    timer.start(callback, 1000);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);

    timer.stop();
  });

  it('stops firing after stop()', () => {
    const timer = new BackgroundTimer();
    const callback = vi.fn();

    timer.start(callback, 1000);
    vi.advanceTimersByTime(1000);
    timer.stop();
    vi.advanceTimersByTime(5000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(timer.isRunning()).toBe(false);
  });

  it('replaces the previous timer on restart', () => {
    const timer = new BackgroundTimer();
    const first = vi.fn();
    const second = vi.fn();

    timer.start(first, 1000);
    timer.start(second, 1000);
    vi.advanceTimersByTime(2000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(2);

    timer.stop();
  });

  it('is safe to stop when never started', () => {
    const timer = new BackgroundTimer();
    expect(() => timer.stop()).not.toThrow();
    expect(timer.isRunning()).toBe(false);
  });
});
