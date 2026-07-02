/**
 * Interval timer that keeps ticking in background tabs.
 *
 * Browsers throttle page timers on hidden tabs (Chrome coalesces them to
 * once per minute after 5 minutes in the background), which slows recording
 * when the user switches away. Dedicated worker threads are exempt from
 * this throttling, so the interval runs in an inline Web Worker and posts a
 * message per tick. Falls back to a regular setInterval when workers are
 * unavailable (e.g. jsdom in tests).
 */
export class BackgroundTimer {
  constructor() {
    this.worker = null;
    this.fallbackId = null;
    this.callback = null;
  }

  /**
   * Whether the timer is currently running.
   * @returns {boolean}
   */
  isRunning() {
    return this.worker !== null || this.fallbackId !== null;
  }

  /**
   * Starts firing the callback on an interval. Stops any previous timer.
   * @param {Function} callback
   * @param {number} intervalMs
   */
  start(callback, intervalMs) {
    this.stop();
    this.callback = callback;

    if (typeof Worker === 'undefined') {
      this.fallbackId = setInterval(() => this.callback(), intervalMs);
      return;
    }

    const workerSource = `
      let id = null;
      onmessage = (e) => {
        if (e.data.command === 'start') {
          clearInterval(id);
          id = setInterval(() => postMessage('tick'), e.data.intervalMs);
        } else if (e.data.command === 'stop') {
          clearInterval(id);
          id = null;
        }
      };
    `;
    const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));
    try {
      this.worker = new Worker(blobUrl);
    } catch (err) {
      // e.g. CSP forbids blob: workers — fall back to a page timer
      console.warn('BackgroundTimer: worker unavailable, using setInterval:', err);
      this.fallbackId = setInterval(() => this.callback(), intervalMs);
      return;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    this.worker.onmessage = () => this.callback();
    this.worker.postMessage({ command: 'start', intervalMs });
  }

  /**
   * Stops the timer.
   */
  stop() {
    if (this.worker) {
      this.worker.postMessage({ command: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }
    if (this.fallbackId !== null) {
      clearInterval(this.fallbackId);
      this.fallbackId = null;
    }
    this.callback = null;
  }
}
