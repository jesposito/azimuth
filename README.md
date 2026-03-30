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
Type an address, landmark, or coordinates into the Start and End fields. The extension geocodes via the Google Maps API already loaded on the page.

### Multi-leg waypoints
Keep clicking after two points to add waypoints. Each leg shows its own bearing line with an arrow and label. The result panel shows per-leg bearings and total distance. Double-click an intermediate waypoint to remove it.

### Draggable markers
After placing points, grab any marker and drag to adjust. Bearings and distances update live as you drag.

### Magnetic declination
Shows both true north and magnetic north bearings, calculated using WMM2025 spherical harmonic coefficients (orders 1-3). Accurate to within 1-2 degrees near the 2025.0 epoch.

### Copy results
One-click copy of all bearing data to clipboard - formatted with per-leg breakdowns for multi-leg routes.

### Keyboard shortcuts
- **Esc** - clear measurement or deactivate tool

## What it shows

- **True bearing** - initial azimuth in degrees (0-360) along the great circle
- **Magnetic bearing** - adjusted for local magnetic declination
- **Cardinal direction** - 16-point compass rose (N, NNE, NE, ENE, E, ...)
- **Distance** - Haversine distance (meters or kilometers)
- **Declination** - local magnetic declination (e.g., "3.2 E")
- **Coordinates** - lat/lng of start and end points

## How it works

Two content scripts running in different Chrome extension "worlds":

- **MAIN world** (`content-main.js`) - accesses the page's `google.maps.Map` instance for coordinate conversion, geocoding, and place search
- **ISOLATED world** (`content-isolated.js`) - handles UI, SVG overlay, click capture, waypoint management, and bearing math

Falls back to URL-based Mercator projection when the Maps API instance can't be found.

### Bearing formula

Forward azimuth:

```
theta = atan2(
  sin(dlng) * cos(lat2),
  cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlng)
)
bearing = (theta + 360) % 360
```

### Magnetic declination

WMM2025 spherical harmonics (orders 1-3):

```
V = a * sum_n sum_m (a/r)^(n+1) * [g*cos(m*lng) + h*sin(m*lng)] * P[n][m]
X = -dV/dtheta / r    (northward component)
Y = -dV/(r*sin(theta)*dlng)   (eastward component)
declination = atan2(Y, X)
```

## File structure

```
azimuth/
  manifest.json              # Chrome Manifest V3 config
  content/
    content-isolated.js      # UI, overlay, waypoints, search, result display
    content-main.js          # Bridge to Google Maps API (geocoding, projection)
    content.css              # All styling
  lib/
    geo.js                   # Bearing, distance, cardinal direction math
    projection.js            # Fallback Mercator projection from URL
    declination.js           # WMM2025 magnetic declination calculator
  popup/
    popup.html               # Extension popup with toggle
    popup.js                 # Toggle state management
    popup.css                # Popup styles
  background/
    service-worker.js        # Badge and message relay
  icons/
    icon16.png, icon48.png, icon128.png
```

## No dependencies

Pure vanilla JavaScript. No build step. No npm. No frameworks.

## License

MIT
