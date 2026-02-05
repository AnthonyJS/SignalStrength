/**
 * Application configuration.
 */
export const Config = {
  // Recording interval in milliseconds (30 seconds)
  recordingInterval: 5000,

  // Speed thresholds in Mbps
  speedThresholds: {
    good: 5,      // >= 5 Mbps = good
    moderate: 1   // >= 1 Mbps = moderate, below = poor
  },

  // Speed test settings
  speedTest: {
    timeout: 5000,  // Timeout in milliseconds
    testUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
    testFileSize: 150000  // ~150KB
  },

  // Geolocation settings
  geolocation: {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }
};
