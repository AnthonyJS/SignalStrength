import { describe, it, expect } from 'vitest';
import { DataPoint } from '../../js/models/DataPoint.js';

describe('DataPoint', () => {
  const validData = {
    timestamp: Date.now(),
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    speedMbps: 12.5,
    connectionType: 'cellular'
  };

  describe('constructor', () => {
    it('creates a valid data point', () => {
      const dp = new DataPoint(validData);
      expect(dp.timestamp).toBe(validData.timestamp);
      expect(dp.latitude).toBe(validData.latitude);
      expect(dp.longitude).toBe(validData.longitude);
      expect(dp.accuracy).toBe(validData.accuracy);
      expect(dp.speedMbps).toBe(validData.speedMbps);
      expect(dp.connectionType).toBe(validData.connectionType);
    });

    it('accepts null speedMbps for offline', () => {
      const dp = new DataPoint({ ...validData, speedMbps: null, connectionType: 'offline' });
      expect(dp.speedMbps).toBeNull();
    });
  });

  describe('validation', () => {
    it('throws on invalid timestamp', () => {
      expect(() => new DataPoint({ ...validData, timestamp: -1 })).toThrow('Invalid timestamp');
      expect(() => new DataPoint({ ...validData, timestamp: 'invalid' })).toThrow('Invalid timestamp');
    });

    it('throws on invalid latitude', () => {
      expect(() => new DataPoint({ ...validData, latitude: -91 })).toThrow('Invalid latitude');
      expect(() => new DataPoint({ ...validData, latitude: 91 })).toThrow('Invalid latitude');
    });

    it('throws on invalid longitude', () => {
      expect(() => new DataPoint({ ...validData, longitude: -181 })).toThrow('Invalid longitude');
      expect(() => new DataPoint({ ...validData, longitude: 181 })).toThrow('Invalid longitude');
    });

    it('throws on invalid accuracy', () => {
      expect(() => new DataPoint({ ...validData, accuracy: -1 })).toThrow('Invalid accuracy');
    });

    it('throws on invalid speedMbps', () => {
      expect(() => new DataPoint({ ...validData, speedMbps: -1 })).toThrow('Invalid speedMbps');
      expect(() => new DataPoint({ ...validData, speedMbps: 'fast' })).toThrow('Invalid speedMbps');
    });

    it('throws on invalid connectionType', () => {
      expect(() => new DataPoint({ ...validData, connectionType: '5G' })).toThrow('Invalid connectionType');
    });
  });

  describe('getQuality', () => {
    it('returns "good" for >= 5 Mbps', () => {
      expect(new DataPoint({ ...validData, speedMbps: 5 }).getQuality()).toBe('good');
      expect(new DataPoint({ ...validData, speedMbps: 100 }).getQuality()).toBe('good');
    });

    it('returns "moderate" for 1-5 Mbps', () => {
      expect(new DataPoint({ ...validData, speedMbps: 1 }).getQuality()).toBe('moderate');
      expect(new DataPoint({ ...validData, speedMbps: 4.9 }).getQuality()).toBe('moderate');
    });

    it('returns "poor" for < 1 Mbps', () => {
      expect(new DataPoint({ ...validData, speedMbps: 0 }).getQuality()).toBe('poor');
      expect(new DataPoint({ ...validData, speedMbps: 0.9 }).getQuality()).toBe('poor');
    });

    it('returns "offline" for null', () => {
      expect(new DataPoint({ ...validData, speedMbps: null, connectionType: 'offline' }).getQuality()).toBe('offline');
    });
  });

  describe('getColor', () => {
    it('returns correct colors for each quality', () => {
      expect(new DataPoint({ ...validData, speedMbps: 10 }).getColor()).toBe('#4CAF50');
      expect(new DataPoint({ ...validData, speedMbps: 3 }).getColor()).toBe('#FFC107');
      expect(new DataPoint({ ...validData, speedMbps: 0.5 }).getColor()).toBe('#f44336');
      expect(new DataPoint({ ...validData, speedMbps: null, connectionType: 'offline' }).getColor()).toBe('#9E9E9E');
    });
  });

  describe('toJSON / fromJSON', () => {
    it('round-trips correctly', () => {
      const dp = new DataPoint(validData);
      const json = dp.toJSON();
      const restored = DataPoint.fromJSON(json);

      expect(restored.timestamp).toBe(dp.timestamp);
      expect(restored.latitude).toBe(dp.latitude);
      expect(restored.longitude).toBe(dp.longitude);
      expect(restored.accuracy).toBe(dp.accuracy);
      expect(restored.speedMbps).toBe(dp.speedMbps);
      expect(restored.connectionType).toBe(dp.connectionType);
    });
  });
});
