import { describe, it, expect, beforeEach } from 'vitest';
import { Journey } from '../../js/models/Journey.js';
import { DataPoint } from '../../js/models/DataPoint.js';

describe('Journey', () => {
  const validDataPoint = {
    timestamp: Date.now(),
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
    speedMbps: 12.5,
    connectionType: 'cellular'
  };

  const validJourney = {
    name: 'Test Journey',
    startTime: Date.now()
  };

  describe('constructor', () => {
    it('creates a journey with auto-generated id', () => {
      const journey = new Journey(validJourney);
      expect(journey.id).toBeDefined();
      expect(journey.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('uses provided id if given', () => {
      const journey = new Journey({ ...validJourney, id: 'custom-id' });
      expect(journey.id).toBe('custom-id');
    });

    it('initializes with empty dataPoints array', () => {
      const journey = new Journey(validJourney);
      expect(journey.dataPoints).toEqual([]);
    });

    it('converts plain objects to DataPoint instances', () => {
      const journey = new Journey({
        ...validJourney,
        dataPoints: [validDataPoint]
      });
      expect(journey.dataPoints[0]).toBeInstanceOf(DataPoint);
    });
  });

  describe('validation', () => {
    it('throws on empty name', () => {
      expect(() => new Journey({ ...validJourney, name: '' })).toThrow('Invalid name');
    });

    it('throws on invalid startTime', () => {
      expect(() => new Journey({ ...validJourney, startTime: -1 })).toThrow('Invalid startTime');
    });

    it('throws if endTime < startTime', () => {
      expect(() => new Journey({
        ...validJourney,
        startTime: 1000,
        endTime: 500
      })).toThrow('Invalid endTime');
    });
  });

  describe('addDataPoint', () => {
    it('adds a DataPoint instance', () => {
      const journey = new Journey(validJourney);
      const dp = new DataPoint(validDataPoint);
      journey.addDataPoint(dp);
      expect(journey.dataPoints).toHaveLength(1);
      expect(journey.dataPoints[0]).toBe(dp);
    });

    it('converts plain object to DataPoint', () => {
      const journey = new Journey(validJourney);
      journey.addDataPoint(validDataPoint);
      expect(journey.dataPoints).toHaveLength(1);
      expect(journey.dataPoints[0]).toBeInstanceOf(DataPoint);
    });
  });

  describe('end', () => {
    it('sets endTime to current time by default', () => {
      const journey = new Journey(validJourney);
      const before = Date.now();
      journey.end();
      const after = Date.now();
      expect(journey.endTime).toBeGreaterThanOrEqual(before);
      expect(journey.endTime).toBeLessThanOrEqual(after);
    });

    it('sets endTime to provided timestamp', () => {
      const journey = new Journey(validJourney);
      journey.end(999999);
      expect(journey.endTime).toBe(999999);
    });
  });

  describe('isRecording', () => {
    it('returns true when endTime is null', () => {
      const journey = new Journey(validJourney);
      expect(journey.isRecording()).toBe(true);
    });

    it('returns false when endTime is set', () => {
      const journey = new Journey({ ...validJourney, endTime: Date.now() + 1000 });
      expect(journey.isRecording()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns correct stats for journey with data points', () => {
      const journey = new Journey({
        ...validJourney,
        dataPoints: [
          { ...validDataPoint, speedMbps: 10 },
          { ...validDataPoint, speedMbps: 5 },
          { ...validDataPoint, speedMbps: 1 },
          { ...validDataPoint, speedMbps: null, connectionType: 'offline' }
        ]
      });

      const stats = journey.getStats();
      expect(stats.pointCount).toBe(4);
      expect(stats.avgSpeed).toBeCloseTo(5.33, 1);
      expect(stats.maxSpeed).toBe(10);
      expect(stats.minSpeed).toBe(1);
      expect(stats.qualityCounts).toEqual({
        good: 2,
        moderate: 1,
        poor: 0,
        offline: 1
      });
    });

    it('handles empty journey', () => {
      const journey = new Journey(validJourney);
      const stats = journey.getStats();
      expect(stats.pointCount).toBe(0);
      expect(stats.avgSpeed).toBeNull();
      expect(stats.maxSpeed).toBeNull();
      expect(stats.minSpeed).toBeNull();
    });
  });

  describe('toJSON / fromJSON', () => {
    it('round-trips correctly', () => {
      const journey = new Journey({
        ...validJourney,
        endTime: Date.now() + 1000,
        dataPoints: [validDataPoint]
      });

      const json = journey.toJSON();
      const restored = Journey.fromJSON(json);

      expect(restored.id).toBe(journey.id);
      expect(restored.name).toBe(journey.name);
      expect(restored.startTime).toBe(journey.startTime);
      expect(restored.endTime).toBe(journey.endTime);
      expect(restored.dataPoints).toHaveLength(1);
      expect(restored.dataPoints[0]).toBeInstanceOf(DataPoint);
    });
  });

  describe('Journey.create', () => {
    it('creates journey with provided name', () => {
      const journey = Journey.create('My Trip');
      expect(journey.name).toBe('My Trip');
      expect(journey.isRecording()).toBe(true);
    });

    it('creates journey with default name if none provided', () => {
      const journey = Journey.create();
      expect(journey.name).toContain('Journey');
    });
  });
});
