/**
 * Formats a speed value in Mbps for display.
 * @param {number|null} speedMbps
 * @param {string} [connectionType] - Used to differentiate offline states.
 * @returns {string}
 */
export function formatSpeed(speedMbps, connectionType) {
  if (speedMbps === null) {
    if (connectionType === 'disconnected') return 'Disconnected';
    if (connectionType === 'no-signal') return 'No signal';
    return 'Offline';
  }
  if (speedMbps >= 10) {
    return `${Math.round(speedMbps)} Mbps`;
  }
  return `${speedMbps.toFixed(1)} Mbps`;
}

/**
 * Human-readable label for a connection type.
 * @param {string} connectionType
 * @returns {string}
 */
export function formatConnectionType(connectionType) {
  switch (connectionType) {
    case 'wifi': return 'Wi-Fi';
    case 'cellular': return 'Cellular';
    case 'disconnected': return 'Disconnected (tether dropped)';
    case 'no-signal': return 'No signal (upstream unreachable)';
    case 'offline': return 'Offline';
    case 'unknown':
    default: return 'Unknown';
  }
}

/**
 * Formats coordinates for display.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string}
 */
export function formatPosition(latitude, longitude) {
  const lat = latitude.toFixed(5);
  const lng = longitude.toFixed(5);
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lngDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(lat)}°${latDir}, ${Math.abs(lng)}°${lngDir}`;
}

/**
 * Formats a timestamp for display.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Formats a duration in milliseconds for display.
 * @param {number} durationMs
 * @returns {string}
 */
export function formatDuration(durationMs) {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Returns the quality label for a speed value.
 * @param {number|null} speedMbps
 * @returns {string}
 */
export function getQualityLabel(speedMbps) {
  if (speedMbps === null) {
    return 'Offline';
  }
  if (speedMbps >= 5) {
    return 'Good';
  }
  if (speedMbps >= 1) {
    return 'Moderate';
  }
  return 'Poor';
}
