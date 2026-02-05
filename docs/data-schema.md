# Data Schema Documentation

## DataPoint

A single measurement taken during a journey.

```json
{
  "timestamp": 1706745600000,
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10,
  "speedMbps": 12.5,
  "connectionType": "cellular"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | number | Yes | Unix timestamp in milliseconds |
| `latitude` | number | Yes | GPS latitude (-90 to 90) |
| `longitude` | number | Yes | GPS longitude (-180 to 180) |
| `accuracy` | number | Yes | GPS accuracy in meters |
| `speedMbps` | number \| null | Yes | Download speed in Mbps, null if offline |
| `connectionType` | string | Yes | One of: 'wifi', 'cellular', 'unknown', 'offline' |

## Journey

A collection of data points recorded during a single trip.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Morning Commute",
  "startTime": 1706745600000,
  "endTime": 1706749200000,
  "dataPoints": [
    {
      "timestamp": 1706745600000,
      "latitude": 37.7749,
      "longitude": -122.4194,
      "accuracy": 10,
      "speedMbps": 12.5,
      "connectionType": "cellular"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID v4 unique identifier |
| `name` | string | Yes | User-provided or auto-generated journey name |
| `startTime` | number | Yes | Unix timestamp of journey start (ms) |
| `endTime` | number \| null | Yes | Unix timestamp of journey end (ms), null if ongoing |
| `dataPoints` | DataPoint[] | Yes | Array of measurements |

## Speed Quality Thresholds

| Quality | Speed Range | Color Code |
|---------|-------------|------------|
| Good | >= 5 Mbps | Green (#4CAF50) |
| Moderate | 1 - 5 Mbps | Yellow (#FFC107) |
| Poor | < 1 Mbps | Red (#f44336) |
| Offline | null | Grey (#9E9E9E) |

## Export Format

When exporting a journey, the JSON file follows this exact structure:

```json
{
  "version": "1.0",
  "exportedAt": "2024-02-01T12:00:00.000Z",
  "journey": {
    "id": "...",
    "name": "...",
    "startTime": 1706745600000,
    "endTime": 1706749200000,
    "dataPoints": [...]
  }
}
```

## IndexedDB Schema

Database name: `signal-strength-db`
Version: 1

### Object Store: `journeys`

- Key path: `id`
- Indexes:
  - `startTime` - for sorting journeys chronologically
  - `name` - for searching by name
