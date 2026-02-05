# Signal Strength Tracker

## Project Overview
A mobile-first web app that tracks internet connection quality along train commute routes by storing GPS coordinates with download speed measurements, then visualizing the data on a map.

## Commands
- `npm run dev` - Start local development server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode

## Architecture

### Views
- **Collector View** - Records journey data (location + speed) at 30-second intervals
- **Map View** - Visualizes stored journeys with color-coded signal quality markers

### Key Services
- `GeolocationService` - Wraps navigator.geolocation with Promise-based API
- `SpeedTestService` - Downloads test file to measure connection speed
- `StorageService` - IndexedDB operations for journey persistence

### Data Models
- `DataPoint` - Single measurement (timestamp, lat/lng, accuracy, speed, connectionType)
- `Journey` - Collection of DataPoints with metadata (id, name, start/end time)

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
