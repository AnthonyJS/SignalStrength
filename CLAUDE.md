# Signal Strength Tracker

## Project Overview
A mobile-first web app that tracks internet connection quality along train commute routes by storing GPS coordinates with download speed measurements, then visualizing the data on a map.

## Commands
- `npm run dev` - Start local development server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode

## Architecture

### Views
- **Collector View** - Records journey data (location + speed) at 30-second intervals. A speed-only mode toggle skips geolocation entirely for devices with location disabled; those points have null coordinates and are omitted from the map.
- **Map View** - Visualizes stored journeys with color-coded signal quality markers

### Key Services
- `GeolocationService` - Wraps navigator.geolocation with Promise-based API
- `SpeedTestService` - Downloads test file to measure connection speed
- `StorageService` - IndexedDB operations for journey persistence

### Data Models
- `DataPoint` - Single measurement (timestamp, lat/lng, accuracy, speed, connectionType)
- `Journey` - Collection of DataPoints with metadata (id, name, start/end time)

### PWA / Offline
- Installable via `manifest.webmanifest` (Chrome install button; iOS Share → Add to Home Screen). Icons live in `icons/`.
- `sw.js` serves the app shell stale-while-revalidate so the app opens with no signal; deploys show up on the second launch. In dev, hard-refresh to bypass it.
- Only URLs listed in `APP_SHELL` / `CDN_ASSETS` are served from cache — never the speed-test download or map tiles. When adding a JS/CSS file or a CDN script, add it to `sw.js` too (`tests/pwa.test.js` enforces this).

## Speed Thresholds
- **Good** (green): >= 5 Mbps
- **Moderate** (yellow): 1-5 Mbps
- **Poor** (red): < 1 Mbps
- **Offline** (grey): null/failed test

## Testing
Tests use Vitest with jsdom for DOM testing. Run `npm test` before committing changes.

## Important Notes
- HTTPS required for Geolocation API
- All data stored locally in IndexedDB
- Speed test uses small ~100KB file to minimize data usage
