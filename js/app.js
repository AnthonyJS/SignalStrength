import { Config } from './Config.js';
import { GeolocationService } from './services/GeolocationService.js';
import { SpeedTestService } from './services/SpeedTestService.js';
import { StorageService } from './services/StorageService.js';
import { CollectorView } from './views/CollectorView.js';
import { MapView } from './views/MapView.js';

/**
 * Main application controller.
 * Handles view routing and service initialization.
 */
class App {
  constructor() {
    // Initialize services with config
    this.services = {
      geolocationService: new GeolocationService(Config.geolocation),
      speedTestService: new SpeedTestService(Config.speedTest),
      storageService: new StorageService()
    };

    // Initialize views with config
    this.views = {
      collector: new CollectorView(this.services, {
        recordingInterval: Config.recordingInterval
      }),
      map: new MapView(this.services)
    };

    this.currentView = 'collector';

    // DOM elements
    this.navTabs = document.querySelectorAll('.nav-tab');
    this.viewElements = document.querySelectorAll('.view');

    this.init();
  }

  /**
   * Initializes the application.
   */
  init() {
    // Bind navigation events
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const viewName = tab.dataset.view;
        this.switchView(viewName);
      });
    });

    // Initialize theme
    this.initTheme();

    // Check for geolocation support
    if (!this.services.geolocationService.isSupported()) {
      this.showUnsupportedMessage('Geolocation is not supported by your browser.');
    }

    // Check for HTTPS (required for geolocation on most browsers)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('Geolocation requires HTTPS. Some features may not work.');
    }
  }

  /**
   * Initializes the theme from localStorage or system preference.
   */
  initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');

    // Apply saved theme or detect system preference
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Bind toggle button
    themeToggle.addEventListener('click', () => this.toggleTheme());
  }

  /**
   * Toggles between light and dark theme.
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  /**
   * Switches to a different view.
   * @param {string} viewName - 'collector' or 'map'
   */
  switchView(viewName) {
    if (viewName === this.currentView) {
      return;
    }

    // Update nav tabs
    this.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Update view visibility
    this.viewElements.forEach(view => {
      const isActive = view.id === `${viewName}-view`;
      view.classList.toggle('active', isActive);
    });

    // Notify views of visibility change
    if (viewName === 'map') {
      this.views.map.onShow();
    }

    this.currentView = viewName;
  }

  /**
   * Shows an unsupported browser message.
   * @param {string} message
   */
  showUnsupportedMessage(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.hidden = false;
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
