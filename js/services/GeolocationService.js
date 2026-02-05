/**
 * Service for handling geolocation operations.
 * Wraps the navigator.geolocation API with a Promise-based interface.
 */
export class GeolocationService {
  /**
   * @param {Object} options
   * @param {boolean} [options.enableHighAccuracy=true] - Use GPS for higher accuracy
   * @param {number} [options.timeout=10000] - Timeout in milliseconds
   * @param {number} [options.maximumAge=0] - Maximum age of cached position
   */
  constructor(options = {}) {
    this.options = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 0
    };
  }

  /**
   * Checks if geolocation is available in the browser.
   * @returns {boolean}
   */
  isSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Gets the current position.
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject(this.translateError(error));
        },
        this.options
      );
    });
  }

  /**
   * Watches position changes.
   * @param {Function} onPosition - Callback for position updates
   * @param {Function} onError - Callback for errors
   * @returns {number} Watch ID for clearing the watch
   */
  watchPosition(onPosition, onError) {
    if (!this.isSupported()) {
      onError(new Error('Geolocation is not supported by this browser'));
      return -1;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        onPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        onError(this.translateError(error));
      },
      this.options
    );
  }

  /**
   * Clears a position watch.
   * @param {number} watchId
   */
  clearWatch(watchId) {
    if (this.isSupported() && watchId !== -1) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  /**
   * Translates geolocation error codes to user-friendly messages.
   * @param {GeolocationPositionError} error
   * @returns {Error}
   */
  translateError(error) {
    const messages = {
      1: 'Location permission denied. Please enable location access in your browser settings.',
      2: 'Unable to determine your location. Please check your device settings.',
      3: 'Location request timed out. Please try again.'
    };

    const message = messages[error.code] || 'An unknown error occurred while getting location.';
    const translatedError = new Error(message);
    translatedError.code = error.code;
    return translatedError;
  }

  /**
   * Requests location permission by attempting to get current position.
   * @returns {Promise<boolean>} True if permission granted
   */
  async requestPermission() {
    try {
      await this.getCurrentPosition();
      return true;
    } catch (error) {
      if (error.code === 1) {
        return false;
      }
      throw error;
    }
  }
}
