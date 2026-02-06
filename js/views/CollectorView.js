import { Journey } from '../models/Journey.js';
import { DataPoint } from '../models/DataPoint.js';
import { formatSpeed, formatPosition, formatTime } from '../utils/formatters.js';

/**
 * View for recording journey data.
 */
export class CollectorView {
  /**
   * @param {Object} services
   * @param {GeolocationService} services.geolocationService
   * @param {SpeedTestService} services.speedTestService
   * @param {StorageService} services.storageService
   * @param {Object} options
   * @param {number} [options.recordingInterval=30000] - Interval between measurements in ms
   */
  constructor({ geolocationService, speedTestService, storageService }, options = {}) {
    this.geolocationService = geolocationService;
    this.speedTestService = speedTestService;
    this.storageService = storageService;

    this.recordingInterval = options.recordingInterval ?? 30000;
    this.maxAccuracy = options.maxAccuracy ?? 100; // meters

    this.currentJourney = null;
    this.intervalId = null;
    this.isRecording = false;
    this.watchId = null;
    this.latestPosition = null;
    this.wakeLock = null;
    this.onDataPointRecorded = null;

    this.elements = {
      view: document.getElementById('collector-view'),
      status: document.getElementById('recording-status'),
      position: document.getElementById('current-position'),
      speed: document.getElementById('current-speed'),
      pointCount: document.getElementById('point-count'),
      journeyName: document.getElementById('journey-name'),
      startBtn: document.getElementById('start-btn'),
      stopBtn: document.getElementById('stop-btn'),
      errorMessage: document.getElementById('error-message'),
      dataPointsList: document.getElementById('data-points-list')
    };

    this.bindEvents();
    this.renderEmptyList();
  }

  /**
   * Binds event listeners to UI elements.
   */
  bindEvents() {
    this.elements.startBtn.addEventListener('click', () => this.startRecording());
    this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
  }

  /**
   * Shows an error message.
   * @param {string} message
   */
  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.hidden = false;
  }

  /**
   * Hides the error message.
   */
  hideError() {
    this.elements.errorMessage.hidden = true;
  }

  /**
   * Updates the UI to reflect recording state.
   */
  updateUI() {
    if (this.isRecording) {
      this.elements.view.classList.add('recording');
      this.elements.status.textContent = 'Measuring...';
      this.elements.startBtn.disabled = true;
      this.elements.stopBtn.disabled = false;
      this.elements.journeyName.disabled = true;
    } else {
      this.elements.view.classList.remove('recording');
      this.elements.status.textContent = 'Stopped';
      this.elements.startBtn.disabled = false;
      this.elements.stopBtn.disabled = true;
      this.elements.journeyName.disabled = false;
    }

    if (this.currentJourney) {
      this.elements.pointCount.textContent = this.currentJourney.dataPoints.length;
    } else {
      this.elements.pointCount.textContent = '0';
    }
  }

  /**
   * Updates the display with the latest measurement.
   * @param {DataPoint} dataPoint
   */
  updateDisplay(dataPoint) {
    this.elements.position.textContent = formatPosition(dataPoint.latitude, dataPoint.longitude);
    this.elements.speed.textContent = formatSpeed(dataPoint.speedMbps);
    this.elements.pointCount.textContent = this.currentJourney?.dataPoints.length || 0;
    this.addDataPointToList(dataPoint);
  }

  /**
   * Renders an empty list message.
   */
  renderEmptyList() {
    this.elements.dataPointsList.innerHTML = '<li class="empty-message">No data points measured yet</li>';
  }

  /**
   * Clears the data points list.
   */
  clearList() {
    this.elements.dataPointsList.innerHTML = '';
  }

  /**
   * Adds a data point to the list display.
   * @param {DataPoint} dataPoint
   */
  addDataPointToList(dataPoint) {
    // Remove empty message if present
    const emptyMessage = this.elements.dataPointsList.querySelector('.empty-message');
    if (emptyMessage) {
      emptyMessage.remove();
    }

    const badgeSpeed = dataPoint.speedMbps === null ? '–' : dataPoint.speedMbps < 1 ? dataPoint.speedMbps.toFixed(1) : Math.round(dataPoint.speedMbps);
    const isPoorAccuracy = dataPoint.accuracy > this.maxAccuracy;
    const accuracyStyle = isPoorAccuracy ? 'color: #f44336; font-weight: 600' : '';
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="point-number" style="background-color: ${dataPoint.getColor()}">${badgeSpeed}</span>
      <div class="point-details">
        <div class="point-time">${formatTime(dataPoint.timestamp)}</div>
        <div class="point-info">${formatSpeed(dataPoint.speedMbps)} &middot; ${formatPosition(dataPoint.latitude, dataPoint.longitude)} &middot; <span style="${accuracyStyle}">±${Math.round(dataPoint.accuracy)}m</span></div>
      </div>
    `;

    // Add to top of list (most recent first)
    this.elements.dataPointsList.insertBefore(li, this.elements.dataPointsList.firstChild);
  }

  /**
   * Requests a wake lock to prevent screen from sleeping.
   */
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake lock acquired');
      } catch (err) {
        console.warn('Wake lock failed:', err);
      }
    }
  }

  /**
   * Releases the wake lock.
   */
  async releaseWakeLock() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      console.log('Wake lock released');
    }
  }

  /**
   * Starts recording a new journey.
   */
  async startRecording() {
    this.hideError();

    try {
      // Request location permission first
      const hasPermission = await this.geolocationService.requestPermission();
      if (!hasPermission) {
        this.showError('Location permission is required to measure a journey.');
        return;
      }

      // Keep screen awake during recording
      await this.requestWakeLock();

      // Create new journey
      const name = this.elements.journeyName.value.trim() || undefined;
      this.currentJourney = Journey.create(name);

      this.isRecording = true;
      this.clearList();
      this.updateUI();

      // Start watching position continuously (better for movement tracking)
      this.watchId = this.geolocationService.watchPosition(
        (position) => {
          this.latestPosition = position;
          // Update position display in real-time
          this.elements.position.textContent = formatPosition(position.latitude, position.longitude);
        },
        (error) => {
          console.error('Position watch error:', error);
        }
      );

      // Wait briefly for first position
      await new Promise(resolve => setTimeout(resolve, 500));

      // Take first measurement immediately
      await this.recordDataPoint();

      // Start interval for subsequent measurements
      this.intervalId = setInterval(() => {
        this.recordDataPoint();
      }, this.recordingInterval);

    } catch (error) {
      this.showError(error.message);
      this.isRecording = false;
      this.updateUI();
    }
  }

  /**
   * Stops the current recording.
   */
  async stopRecording() {
    if (!this.isRecording || !this.currentJourney) {
      return;
    }

    if (!confirm('Stop measuring this journey?')) {
      return;
    }

    // Stop interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop watching position
    if (this.watchId !== null) {
      this.geolocationService.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.latestPosition = null;

    // Release wake lock
    await this.releaseWakeLock();

    // End journey
    this.currentJourney.end();

    try {
      // Save to storage
      await this.storageService.saveJourney(this.currentJourney);
    } catch (error) {
      this.showError(`Failed to save journey: ${error.message}`);
    }

    this.isRecording = false;
    this.currentJourney = null;
    this.elements.journeyName.value = '';
    this.elements.position.textContent = '--';
    this.elements.speed.textContent = '-- Mbps';
    this.renderEmptyList();
    this.updateUI();
  }

  /**
   * Records a single data point (position + speed).
   */
  async recordDataPoint() {
    if (!this.isRecording || !this.currentJourney) {
      return;
    }

    try {
      // Use latest position from watcher, or get current if not available
      let position = this.latestPosition;
      if (!position) {
        position = await this.geolocationService.getCurrentPosition();
      }

      // Measure speed
      const speedResult = await this.speedTestService.measureSpeed();

      const dataPoint = new DataPoint({
        timestamp: Date.now(),
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        speedMbps: speedResult.speedMbps,
        connectionType: speedResult.connectionType
      });

      this.currentJourney.addDataPoint(dataPoint);
      this.updateDisplay(dataPoint);

      // Auto-save after each point
      await this.storageService.saveJourney(this.currentJourney);

      // Notify listeners (e.g. MapView)
      if (this.onDataPointRecorded) {
        this.onDataPointRecorded(dataPoint, this.currentJourney);
      }

    } catch (error) {
      // Don't stop recording on individual measurement errors
      console.error('Failed to record data point:', error);

      // Show error but keep recording
      this.elements.position.textContent = 'Error';
      this.elements.speed.textContent = 'Error';
    }
  }

  /**
   * Cleans up when view is hidden.
   */
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.watchId !== null) {
      this.geolocationService.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.releaseWakeLock();
  }
}
