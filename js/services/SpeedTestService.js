/**
 * Service for measuring download speed.
 * Downloads a test file and calculates the speed in Mbps.
 */
export class SpeedTestService {
  /**
   * @param {Object} options
   * @param {string} [options.testUrl] - URL of test file to download
   * @param {number} [options.testFileSize] - Expected size of test file in bytes
   * @param {number} [options.timeout=5000] - Timeout in milliseconds
   */
  constructor(options = {}) {
    // Using a small file from a reliable CDN
    // This is a ~100KB file that's good for quick speed tests
    this.testUrl = options.testUrl || 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
    this.testFileSize = options.testFileSize || 150000; // ~150KB
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Detects the current connection type reported by the OS.
   * Returns 'disconnected' when navigator.onLine is false — on a tethered
   * laptop this typically means the Wi-Fi/USB tether has dropped, since the
   * OS only flips onLine to false when the local network interface is gone.
   * A phone with poor mobile signal but live tethering stays onLine === true.
   * @returns {'wifi'|'cellular'|'unknown'|'disconnected'}
   */
  getConnectionType() {
    if (!navigator.onLine) {
      return 'disconnected';
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) {
      return 'unknown';
    }

    const type = connection.type || connection.effectiveType;
    if (type === 'wifi') {
      return 'wifi';
    }
    if (['cellular', '2g', '3g', '4g', '5g'].includes(type)) {
      return 'cellular';
    }
    return 'unknown';
  }

  /**
   * Measures the download speed.
   * When the test cannot complete we distinguish two failure modes:
   *   - 'disconnected': navigator.onLine is false (local network gone).
   *   - 'no-signal': onLine is true but the fetch aborted/errored (the
   *     upstream link — e.g. the phone's mobile signal — is unreachable).
   * @returns {Promise<{speedMbps: number|null, connectionType: string}>}
   */
  async measureSpeed() {
    const connectionType = this.getConnectionType();

    if (connectionType === 'disconnected') {
      return { speedMbps: null, connectionType: 'disconnected' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Add cache-busting parameter
      const url = `${this.testUrl}?_t=${Date.now()}`;
      const startTime = performance.now();

      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Read the entire response body
      const blob = await response.blob();
      const endTime = performance.now();

      clearTimeout(timeoutId);

      // Calculate speed
      const durationSeconds = (endTime - startTime) / 1000;
      const bytesDownloaded = blob.size || this.testFileSize;
      const bitsDownloaded = bytesDownloaded * 8;
      const speedMbps = (bitsDownloaded / durationSeconds) / 1000000;

      return {
        speedMbps: Math.round(speedMbps * 100) / 100, // Round to 2 decimal places
        connectionType
      };
    } catch (error) {
      // Re-check onLine first: it may have flipped during the fetch.
      if (!navigator.onLine) {
        return { speedMbps: null, connectionType: 'disconnected' };
      }
      // Local network is still up but the test failed — upstream link dead.
      return { speedMbps: null, connectionType: 'no-signal' };
    }
  }

  /**
   * Runs multiple speed tests and returns the average.
   * @param {number} [count=3] - Number of tests to run
   * @returns {Promise<{speedMbps: number|null, connectionType: string}>}
   */
  async measureSpeedAverage(count = 3) {
    const results = [];
    let lastConnectionType = this.getConnectionType();

    for (let i = 0; i < count; i++) {
      const result = await this.measureSpeed();
      lastConnectionType = result.connectionType;
      if (result.speedMbps !== null) {
        results.push(result.speedMbps);
      }
    }

    if (results.length === 0) {
      return { speedMbps: null, connectionType: lastConnectionType };
    }

    const avgSpeed = results.reduce((a, b) => a + b, 0) / results.length;
    return {
      speedMbps: Math.round(avgSpeed * 100) / 100,
      connectionType: lastConnectionType
    };
  }
}
