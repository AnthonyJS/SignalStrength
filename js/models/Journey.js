import { DataPoint } from './DataPoint.js';

/**
 * Generates a UUID v4.
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Represents a journey containing multiple data points.
 */
export class Journey {
  /**
   * @param {Object} data
   * @param {string} [data.id] - UUID, auto-generated if not provided
   * @param {string} data.name - User-provided or auto-generated name
   * @param {number} data.startTime - Unix timestamp in milliseconds
   * @param {number|null} [data.endTime] - Unix timestamp in milliseconds, null if ongoing
   * @param {Array<DataPoint|Object>} [data.dataPoints] - Array of data points
   */
  constructor({ id, name, startTime, endTime = null, dataPoints = [] }) {
    this.id = id || generateUUID();
    this.name = name;
    this.startTime = startTime;
    this.endTime = endTime;
    this.dataPoints = dataPoints.map(dp =>
      dp instanceof DataPoint ? dp : DataPoint.fromJSON(dp)
    );

    this.validate();
  }

  /**
   * Validates the journey fields.
   * @throws {Error} if validation fails
   */
  validate() {
    if (typeof this.id !== 'string' || this.id.length === 0) {
      throw new Error('Invalid id: must be a non-empty string');
    }

    if (typeof this.name !== 'string' || this.name.length === 0) {
      throw new Error('Invalid name: must be a non-empty string');
    }

    if (typeof this.startTime !== 'number' || this.startTime <= 0) {
      throw new Error('Invalid startTime: must be a positive number');
    }

    if (this.endTime !== null && (typeof this.endTime !== 'number' || this.endTime <= 0)) {
      throw new Error('Invalid endTime: must be null or a positive number');
    }

    if (this.endTime !== null && this.endTime < this.startTime) {
      throw new Error('Invalid endTime: must be greater than or equal to startTime');
    }

    if (!Array.isArray(this.dataPoints)) {
      throw new Error('Invalid dataPoints: must be an array');
    }
  }

  /**
   * Adds a data point to the journey.
   * @param {DataPoint|Object} dataPoint
   */
  addDataPoint(dataPoint) {
    const point = dataPoint instanceof DataPoint ? dataPoint : DataPoint.fromJSON(dataPoint);
    this.dataPoints.push(point);
  }

  /**
   * Ends the journey with the given timestamp.
   * @param {number} [timestamp] - Unix timestamp, defaults to current time
   */
  end(timestamp = Date.now()) {
    this.endTime = timestamp;
  }

  /**
   * Checks if the journey is currently recording.
   * @returns {boolean}
   */
  isRecording() {
    return this.endTime === null;
  }

  /**
   * Returns the duration of the journey in milliseconds.
   * @returns {number}
   */
  getDuration() {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * Returns statistics about the journey.
   * @returns {Object}
   */
  getStats() {
    const speeds = this.dataPoints
      .map(dp => dp.speedMbps)
      .filter(speed => speed !== null);

    const avgSpeed = speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : null;

    const qualityCounts = { good: 0, moderate: 0, poor: 0, offline: 0 };
    this.dataPoints.forEach(dp => {
      qualityCounts[dp.getQuality()]++;
    });

    return {
      pointCount: this.dataPoints.length,
      avgSpeed,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
      minSpeed: speeds.length > 0 ? Math.min(...speeds) : null,
      qualityCounts,
      duration: this.getDuration()
    };
  }

  /**
   * Converts the journey to a plain object for storage.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      dataPoints: this.dataPoints.map(dp => dp.toJSON())
    };
  }

  /**
   * Creates a Journey from a plain object.
   * @param {Object} obj
   * @returns {Journey}
   */
  static fromJSON(obj) {
    return new Journey(obj);
  }

  /**
   * Creates a new journey with an auto-generated name.
   * @returns {Journey}
   */
  static create(name) {
    const now = Date.now();
    const defaultName = name || `Journey ${new Date(now).toLocaleDateString()}`;
    return new Journey({
      name: defaultName,
      startTime: now
    });
  }
}
