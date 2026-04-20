import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeedTestService } from '../../js/services/SpeedTestService.js';

describe('SpeedTestService', () => {
  let service;

  beforeEach(() => {
    service = new SpeedTestService({
      testUrl: 'https://example.com/test.js',
      testFileSize: 100000,
      timeout: 5000
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true
    });

    // Reset navigator.connection
    Object.defineProperty(navigator, 'connection', {
      value: undefined,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('uses default values when no options provided', () => {
      const defaultService = new SpeedTestService();
      expect(defaultService.testUrl).toContain('leaflet');
      expect(defaultService.timeout).toBe(5000);
    });

    it('uses provided options', () => {
      expect(service.testUrl).toBe('https://example.com/test.js');
      expect(service.testFileSize).toBe(100000);
      expect(service.timeout).toBe(5000);
    });
  });

  describe('getConnectionType', () => {
    it('returns "disconnected" when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      expect(service.getConnectionType()).toBe('disconnected');
    });

    it('returns "unknown" when connection API is not available', () => {
      Object.defineProperty(navigator, 'onLine', { value: true });
      expect(service.getConnectionType()).toBe('unknown');
    });

    it('returns "wifi" for wifi connection', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { type: 'wifi' },
        configurable: true
      });
      expect(service.getConnectionType()).toBe('wifi');
    });

    it('returns "cellular" for cellular connection types', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '4g' },
        configurable: true
      });
      expect(service.getConnectionType()).toBe('cellular');
    });
  });

  describe('measureSpeed', () => {
    it('returns disconnected when not online', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      const result = await service.measureSpeed();

      expect(result.speedMbps).toBeNull();
      expect(result.connectionType).toBe('disconnected');
    });

    it('calculates speed from successful fetch', async () => {
      const mockBlob = { size: 100000 };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      });

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)     // startTime
        .mockReturnValueOnce(1000); // endTime (1 second later)

      const result = await service.measureSpeed();

      expect(result.speedMbps).toBe(0.8); // 100000 bytes * 8 bits / 1 second / 1000000
      expect(result.connectionType).toBe('unknown');
    });

    it('reports no-signal when fetch times out but onLine stays true', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const result = await service.measureSpeed();

      expect(result.speedMbps).toBeNull();
      expect(result.connectionType).toBe('no-signal');
    });

    it('reports disconnected when fetch fails and onLine flipped to false', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        // Simulate tether drop during the fetch.
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        return Promise.reject(new Error('Network error'));
      });

      const result = await service.measureSpeed();

      expect(result.speedMbps).toBeNull();
      expect(result.connectionType).toBe('disconnected');
    });

    it('reports no-signal on generic network errors while onLine', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await service.measureSpeed();

      expect(result.speedMbps).toBeNull();
      expect(result.connectionType).toBe('no-signal');
    });
  });

  describe('measureSpeedAverage', () => {
    it('returns average of multiple measurements', async () => {
      let callCount = 0;
      vi.spyOn(service, 'measureSpeed').mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          speedMbps: callCount * 10, // 10, 20, 30
          connectionType: 'unknown'
        });
      });

      const result = await service.measureSpeedAverage(3);

      expect(result.speedMbps).toBe(20); // (10 + 20 + 30) / 3
    });

    it('handles all measurements failing', async () => {
      vi.spyOn(service, 'measureSpeed').mockResolvedValue({
        speedMbps: null,
        connectionType: 'no-signal'
      });

      const result = await service.measureSpeedAverage(3);

      expect(result.speedMbps).toBeNull();
      expect(result.connectionType).toBe('no-signal');
    });

    it('preserves disconnected state from the last failed measurement', async () => {
      vi.spyOn(service, 'measureSpeed').mockResolvedValue({
        speedMbps: null,
        connectionType: 'disconnected'
      });

      const result = await service.measureSpeedAverage(2);

      expect(result.speedMbps).toBeNull();
      expect(result.connectionType).toBe('disconnected');
    });
  });
});
