/**
 * Represents a single measurement point in a journey.
 */
export class DataPoint {
  /**
   * @param {Object} data
   * @param {number} data.timestamp - Unix timestamp in milliseconds
   * @param {number} data.latitude - GPS latitude (-90 to 90)
   * @param {number} data.longitude - GPS longitude (-180 to 180)
   * @param {number} data.accuracy - GPS accuracy in meters
   * @param {number|null} data.speedMbps - Download speed in Mbps, null if offline
   * @param {string} data.connectionType - 'wifi', 'cellular', 'unknown', or 'offline'
   */
  constructor({ timestamp, latitude, longitude, accuracy, speedMbps, connectionType }) {
    this.timestamp = timestamp;
    this.latitude = latitude;
    this.longitude = longitude;
    this.accuracy = accuracy;
    this.speedMbps = speedMbps;
    this.connectionType = connectionType;

    this.validate();
  }

  /**
   * Validates the data point fields.
   * @throws {Error} if validation fails
   */
  validate() {
    if (typeof this.timestamp !== 'number' || this.timestamp <= 0) {
      throw new Error('Invalid timestamp: must be a positive number');
    }

    if (typeof this.latitude !== 'number' || this.latitude < -90 || this.latitude > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }

    if (typeof this.longitude !== 'number' || this.longitude < -180 || this.longitude > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }

    if (typeof this.accuracy !== 'number' || this.accuracy < 0) {
      throw new Error('Invalid accuracy: must be a non-negative number');
    }

    if (this.speedMbps !== null && (typeof this.speedMbps !== 'number' || this.speedMbps < 0)) {
      throw new Error('Invalid speedMbps: must be null or a non-negative number');
    }

    const validConnectionTypes = ['wifi', 'cellular', 'unknown', 'offline'];
    if (!validConnectionTypes.includes(this.connectionType)) {
      throw new Error(`Invalid connectionType: must be one of ${validConnectionTypes.join(', ')}`);
    }
  }

  /**
   * Returns the quality level based on speed.
   * @returns {'good'|'moderate'|'poor'|'offline'}
   */
  getQuality() {
    if (this.speedMbps === null) {
      return 'offline';
    }
    if (this.speedMbps >= 2) {
      return 'good';
    }
    if (this.speedMbps >= 1) {
      return 'moderate';
    }
    return 'poor';
  }

  /**
   * Returns the color for map display based on quality.
   * @returns {string} Hex color code
   */
  getColor() {
    const colors = {
      good: '#4CAF50',
      moderate: '#FFC107',
      poor: '#f44336',
      offline: '#9E9E9E'
    };
    return colors[this.getQuality()];
  }

  /**
   * Converts the data point to a plain object for storage.
   * @returns {Object}
   */
  toJSON() {
    return {
      timestamp: this.timestamp,
      latitude: this.latitude,
      longitude: this.longitude,
      accuracy: this.accuracy,
      speedMbps: this.speedMbps,
      connectionType: this.connectionType
    };
  }

  /**
   * Creates a DataPoint from a plain object.
   * @param {Object} obj
   * @returns {DataPoint}
   */
  static fromJSON(obj) {
    return new DataPoint(obj);
  }
}
