import { formatSpeed, formatTime } from '../utils/formatters.js';

/**
 * View for displaying journey data on a map.
 */
export class MapView {
  /**
   * @param {Object} services
   * @param {StorageService} services.storageService
   * @param {Object} options
   * @param {number} [options.maxAccuracy=100] - Max accuracy in meters for displayed points
   */
  constructor({ storageService }, options = {}) {
    this.storageService = storageService;
    this.maxAccuracy = options.maxAccuracy ?? 100;

    this.map = null;
    this.markersLayer = null;
    this.polylineLayer = null;
    this.currentJourney = null;
    this.userHasZoomed = false;
    this.showLowAccuracy = false;

    this.elements = {
      view: document.getElementById('map-view'),
      mapContainer: document.getElementById('map'),
      journeySelect: document.getElementById('journey-select'),
      exportBtn: document.getElementById('export-btn'),
      deleteBtn: document.getElementById('delete-btn'),
      importFile: document.getElementById('import-file'),
      accuracyToggle: document.getElementById('show-low-accuracy')
    };

    this.bindEvents();
  }

  /**
   * Binds event listeners to UI elements.
   */
  bindEvents() {
    this.elements.journeySelect.addEventListener('change', (e) => {
      this.loadJourney(e.target.value);
    });

    this.elements.exportBtn.addEventListener('click', () => {
      this.exportCurrentJourney();
    });

    this.elements.deleteBtn.addEventListener('click', () => {
      this.deleteCurrentJourney();
    });

    this.elements.importFile.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.importJourney(e.target.files[0]);
        e.target.value = ''; // Reset file input
      }
    });

    this.elements.accuracyToggle.addEventListener('change', (e) => {
      this.showLowAccuracy = e.target.checked;
      if (this.currentJourney) {
        this.renderJourney(this.currentJourney);
      }
    });
  }

  /**
   * Initializes the map.
   */
  initMap() {
    if (this.map) {
      return;
    }

    // Initialize Leaflet map centered on a default location
    this.map = L.map(this.elements.mapContainer, {
      doubleTapDragZoom: 'center'
    }).setView([37.7749, -122.4194], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Track user-initiated zoom/pan to avoid overriding their view
    this.map.on('zoomstart', () => {
      this.userHasZoomed = true;
    });
    this.map.on('dragstart', () => {
      this.userHasZoomed = true;
    });

    // Create layer groups for markers and polylines
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.polylineLayer = L.layerGroup().addTo(this.map);
  }

  /**
   * Called when the view becomes visible.
   */
  async onShow() {
    // Initialize map if needed (must be done when visible)
    this.initMap();

    // Reset user zoom flag so we auto-fit on tab switch
    this.userHasZoomed = false;

    // Refresh journey list and auto-select the most recent
    await this.refreshJourneyList(true);

    // Invalidate size after the view is visible, then re-fit bounds
    setTimeout(() => {
      this.map.invalidateSize();
      if (this.currentJourney?.dataPoints.length > 0) {
        const bounds = L.latLngBounds(
          this.currentJourney.dataPoints.map(p => [p.latitude, p.longitude])
        );
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, 100);
  }

  /**
   * Refreshes the journey selector dropdown.
   * @param {boolean} autoSelectLatest - Auto-select the most recent journey
   */
  async refreshJourneyList(autoSelectLatest = false) {
    const journeys = await this.storageService.getAllJourneys();

    // Clear existing options (except placeholder)
    while (this.elements.journeySelect.options.length > 1) {
      this.elements.journeySelect.remove(1);
    }

    // Add journey options
    journeys.forEach(journey => {
      const option = document.createElement('option');
      option.value = journey.id;
      option.textContent = `${journey.name} (${formatTime(journey.startTime)})`;
      this.elements.journeySelect.appendChild(option);
    });

    // Auto-select the most recent journey if requested
    if (autoSelectLatest && journeys.length > 0) {
      this.elements.journeySelect.value = journeys[0].id;
      await this.loadJourney(journeys[0].id);
    }

    // Update button states
    this.updateButtonStates();
  }

  /**
   * Loads and displays a journey on the map.
   * @param {string} journeyId
   */
  async loadJourney(journeyId) {
    this.clearMap();

    if (!journeyId) {
      this.currentJourney = null;
      this.updateButtonStates();
      return;
    }

    const journey = await this.storageService.getJourney(journeyId);
    if (!journey) {
      return;
    }

    this.currentJourney = journey;
    this.updateButtonStates();
    this.renderJourney(journey, true);
  }

  /**
   * Renders a journey on the map.
   * @param {Journey} journey
   * @param {boolean} fitBounds - Whether to fit the map to show all points
   */
  renderJourney(journey, fitBounds = false) {
    this.clearMap();

    // Filter points based on accuracy toggle
    const points = this.showLowAccuracy
      ? journey.dataPoints
      : journey.dataPoints.filter(dp => dp.accuracy <= this.maxAccuracy);

    if (points.length === 0) {
      return;
    }

    // Create markers for each data point
    const latlngs = [];
    points.forEach((dp, index) => {
      const latlng = [dp.latitude, dp.longitude];
      latlngs.push(latlng);

      const isPoorAccuracy = dp.accuracy > this.maxAccuracy;

      // Create colored circle marker (smaller and more transparent for poor accuracy)
      const marker = L.circleMarker(latlng, {
        radius: isPoorAccuracy ? 6 : 8,
        fillColor: dp.getColor(),
        color: isPoorAccuracy ? '#999' : dp.getColor(),
        weight: isPoorAccuracy ? 1 : 0,
        fillOpacity: isPoorAccuracy ? 0.5 : 0.9
      });

      // Add popup with details
      const popupContent = `
        <strong>Point ${index + 1}</strong><br>
        Time: ${formatTime(dp.timestamp)}<br>
        Speed: ${formatSpeed(dp.speedMbps)}<br>
        Connection: ${dp.connectionType}<br>
        Accuracy: ${Math.round(dp.accuracy)}m${isPoorAccuracy ? ' (low)' : ''}
      `;
      marker.bindPopup(popupContent);

      this.markersLayer.addLayer(marker);
    });

    // Draw polyline connecting points
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, {
        color: '#2196F3',
        weight: 3,
        opacity: 0.6
      });
      this.polylineLayer.addLayer(polyline);
    }

    // Fit map to show all points
    if (fitBounds && latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Adds a single data point to the map for a live-recording journey.
   * @param {DataPoint} dp
   * @param {Journey} journey
   */
  addDataPoint(dp, journey) {
    // Only update if the map is showing this journey (or no journey yet selected)
    if (!this.map) {
      return;
    }

    // If map is showing a different journey, ignore
    if (this.currentJourney && this.currentJourney.id !== journey.id) {
      return;
    }

    // Update internal reference so dropdown stays in sync
    this.currentJourney = journey;

    const isPoorAccuracy = dp.accuracy > this.maxAccuracy;
    const shouldShowPoint = this.showLowAccuracy || !isPoorAccuracy;

    // Add marker if it should be shown
    if (shouldShowPoint) {
      const latlng = [dp.latitude, dp.longitude];
      const index = journey.dataPoints.length - 1;

      // Create marker (smaller and more transparent for poor accuracy)
      const marker = L.circleMarker(latlng, {
        radius: isPoorAccuracy ? 6 : 8,
        fillColor: dp.getColor(),
        color: isPoorAccuracy ? '#999' : dp.getColor(),
        weight: isPoorAccuracy ? 1 : 0,
        fillOpacity: isPoorAccuracy ? 0.5 : 0.9
      });

      const popupContent = `
        <strong>Point ${index + 1}</strong><br>
        Time: ${formatTime(dp.timestamp)}<br>
        Speed: ${formatSpeed(dp.speedMbps)}<br>
        Connection: ${dp.connectionType}<br>
        Accuracy: ${Math.round(dp.accuracy)}m${isPoorAccuracy ? ' (low)' : ''}
      `;
      marker.bindPopup(popupContent);
      this.markersLayer.addLayer(marker);
    }

    // Update polyline using filtered points
    this.polylineLayer.clearLayers();
    const filteredPoints = this.showLowAccuracy
      ? journey.dataPoints
      : journey.dataPoints.filter(p => p.accuracy <= this.maxAccuracy);
    if (filteredPoints.length > 1) {
      const latlngs = filteredPoints.map(p => [p.latitude, p.longitude]);
      const polyline = L.polyline(latlngs, {
        color: '#2196F3',
        weight: 3,
        opacity: 0.6
      });
      this.polylineLayer.addLayer(polyline);
    }

    // Only auto-fit if user hasn't manually zoomed/panned since opening map tab
    if (!this.userHasZoomed && filteredPoints.length > 0) {
      const allLatLngs = filteredPoints.map(p => [p.latitude, p.longitude]);
      this.map.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
    }
  }

  /**
   * Clears all markers and polylines from the map.
   */
  clearMap() {
    if (this.markersLayer) {
      this.markersLayer.clearLayers();
    }
    if (this.polylineLayer) {
      this.polylineLayer.clearLayers();
    }
  }

  /**
   * Updates export and delete button states.
   */
  updateButtonStates() {
    const hasJourney = this.currentJourney !== null;
    this.elements.exportBtn.disabled = !hasJourney;
    this.elements.deleteBtn.disabled = !hasJourney;
  }

  /**
   * Exports the current journey as JSON.
   */
  async exportCurrentJourney() {
    if (this.currentJourney) {
      try {
        await this.storageService.exportJourney(this.currentJourney);
      } catch (e) {
        // User cancelled the share sheet — not an error
        if (e.name !== 'AbortError') throw e;
      }
    }
  }

  /**
   * Deletes the current journey.
   */
  async deleteCurrentJourney() {
    if (!this.currentJourney) {
      return;
    }

    const confirmed = confirm(`Delete journey "${this.currentJourney.name}"?`);
    if (!confirmed) {
      return;
    }

    await this.storageService.deleteJourney(this.currentJourney.id);

    // Reset selection and refresh
    this.elements.journeySelect.value = '';
    this.currentJourney = null;
    this.clearMap();
    await this.refreshJourneyList();
  }

  /**
   * Imports a journey from a JSON file.
   * @param {File} file
   */
  async importJourney(file) {
    try {
      const journey = await this.storageService.importJourney(file);
      await this.refreshJourneyList();

      // Select and display the imported journey
      this.elements.journeySelect.value = journey.id;
      await this.loadJourney(journey.id);

      alert(`Successfully imported "${journey.name}"`);
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  }

  /**
   * Cleans up when view is hidden.
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
