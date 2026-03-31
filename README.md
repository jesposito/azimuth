# Azimuth

A Chrome extension for measuring compass bearings and distances on Google Maps.

Click points on the map, type addresses, or plan multi-leg routes. Get true and magnetic bearings, distances, and cardinal directions.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4) ![License](https://img.shields.io/badge/license-MIT-green)

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `azimuth` folder

## Features

### Click to measure
1. Click the compass button on the map (or toggle via the extension popup)
2. Click to place your **start point** (green marker)
3. Click to place your **end point** (red marker)
4. View bearing, distance, and coordinates

### Address / place search
Type an address, landmark, or coordinates into the Start and End fields. Supports:
- Place names and addresses (geocoded via the Google Maps API on the page)
- Decimal coordinates: `40.7128, -74.006`
- Cardinal coordinates: `40.7128N 74.006W`

### Multi-leg waypoints
Keep clicking after two points to add waypoints. Each leg shows its own bearing line with a direction arrow and label. The result panel shows per-leg bearings and a total distance summary.

### Ghost midpoint markers
Hover between existing markers to see a translucent ghost marker on each line segment. Drag it to insert a new waypoint at that position.

### Draggable markers
Grab any marker and drag to adjust. Bearings and distances update live as you drag. A coordinate tooltip follows the cursor during drag.

### Delete waypoints
Hover over an intermediate marker to reveal an X button. Click it to remove that waypoint.

### Magnetic declination
Shows both true north and magnetic north bearings, calculated using the full WMM2020 spherical harmonic model (orders 1-12, 168 coefficients). Accurate to within 0.5 degrees of the official BGS/NOAA WMM2020 calculator through the model epoch.

### Real-time map tracking
Markers and lines stay anchored to their geographic positions during map pan and zoom, using live event updates from the Maps API.

### Copy results
One-click copy of all bearing data to clipboard, formatted with per-leg breakdowns for multi-leg routes.

### Keyboard shortcuts
- **Esc** - clear measurement or deactivate tool
- **Ctrl+Z** / **Cmd+Z** - undo last placed point (also cancels active drag)

## What it shows

- **True bearing** - initial azimuth in degrees (0-360) along the great circle
- **Magnetic bearing** - adjusted for local magnetic declination
- **Reciprocal bearing** - the reverse direction (bearing + 180)
- **Cardinal direction** - 16-point compass rose (N, NNE, NE, ENE, E, ...)
- **Distance** - Haversine great-circle distance (meters or kilometers)
- **Declination** - local magnetic declination with direction (e.g., "3.2 E")
- **Coordinates** - lat/lng of start and end points

## How it works

Two content scripts running in different Chrome extension "worlds":

- **MAIN world** (`content-main.js`) - accesses the page's `google.maps.Map` instance for coordinate conversion, geocoding, place autocomplete, and real-time map movement events
- **ISOLATED world** (`content-isolated.js`) - handles UI, SVG overlay, click capture, waypoint management, search, and bearing math

Communication between worlds uses `window.postMessage` with a session nonce for security.

Falls back to URL-based Mercator projection when the Maps API instance can't be found.

### Bearing formula

Forward azimuth (great circle initial bearing):

```
theta = atan2(
  sin(dlng) * cos(lat2),
  cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlng)
)
bearing = (theta + 360) % 360
```

### Distance

Haversine formula on a sphere of radius R = 6,371 km. Accuracy is within 0.5% of WGS84 ellipsoidal distances for most routes, up to ~0.7% for long east-west routes at mid-latitudes.

### Magnetic declination

Full WMM2020 spherical harmonic expansion (orders 1-12):

```
V = a * sum_n sum_m (a/r)^(n+1) * [g*cos(m*lng) + h*sin(m*lng)] * P[n][m]
X = -dV/dtheta / r                      (northward component)
Y = -dV/(r*sin(theta)*dlng)             (eastward component)
declination = atan2(Y, X)
```

Schmidt semi-normalized associated Legendre polynomials with secular variation extrapolation from epoch 2020.0.

## Accuracy

Validated against authoritative reference sources (see `test/test-validation.js`):

| Metric | Reference source | Tolerance |
|--------|-----------------|-----------|
| Bearing | GeographicLib GeodSolve (WGS84 ellipsoidal) | < 0.1 deg |
| Distance | GeographicLib GeodSolve | < 0.7% |
| Declination | BGS World Magnetic Model 2020 | < 0.5 deg |

Test routes: JFK-LHR, Sydney-Tokyo, NYC-LAX, Wellington-Cape Town. Declination verified at NYC, Denver, London, Tokyo, Sydney, Wellington.

## Testing

```
node --test test/test-geo.js test/test-declination.js test/test-geocoding.js test/test-projection.js test/test-integration.js test/test-validation.js
```

115 tests covering bearing, distance, cardinal directions, distance formatting, magnetic declination, coordinate parsing, Mercator projection, and validation against authoritative geodetic references.

## File structure

```
azimuth/
  manifest.json              # Chrome Manifest V3 config
  content/
    content-isolated.js      # UI, overlay, waypoints, search, result display
    content-main.js          # Bridge to Google Maps API (projection, geocoding, events)
    content.css              # All styling (WCAG 2.2 AA compliant)
  lib/
    geo.js                   # Bearing, Haversine distance, cardinal direction
    projection.js            # Fallback Mercator projection from URL
    declination.js           # WMM2020 magnetic declination (full order 1-12)
    geocoding.js             # Coordinate string parsing
  popup/
    popup.html               # Extension popup with toggle
    popup.js                 # Toggle state management
    popup.css                # Popup styles
  background/
    service-worker.js        # Badge, message relay, Nominatim geocoding fallback
  test/
    test-geo.js              # Bearing, distance, cardinal, formatting tests
    test-declination.js      # WMM2020 model tests
    test-geocoding.js        # Coordinate parsing tests
    test-projection.js       # Mercator fallback tests
    test-integration.js      # Cross-module integration tests
    test-validation.js       # Authoritative reference validation
    load-module.js           # Test helper for loading IIFE modules
  icons/
    icon16.png, icon48.png, icon128.png
```

## No dependencies

Pure vanilla JavaScript. No build step. No npm. No frameworks. Tests use Node.js built-in test runner.

## License

MIT
