# Azimuth

A Chrome extension that lets you draw a line on Google Maps to get a compass bearing and distance.

Click two points on the map. Get the bearing in degrees, cardinal direction, and distance between them. That's it.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285f4) ![License](https://img.shields.io/badge/license-MIT-green)

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `azimuth` folder

## Usage

1. Navigate to [Google Maps](https://www.google.com/maps)
2. Click the compass button on the right side of the map (or toggle via the extension popup)
3. Click to place your **start point** (A)
4. Click to place your **end point** (B)
5. Read the bearing and distance

- Click again to start a new measurement
- Press **Esc** to clear or deactivate
- Toggle off via the compass button or extension popup

## What it shows

- **Bearing** - initial azimuth in degrees (0-360) from point A to point B along the great circle
- **Cardinal direction** - 16-point compass rose (N, NNE, NE, ENE, E, ...)
- **Distance** - Haversine distance (meters or kilometers)

## How it works

The extension uses two content scripts running in different Chrome extension "worlds":

- **MAIN world** (`content-main.js`) - has access to the page's `google.maps.Map` instance for accurate coordinate conversion via the Maps JavaScript API projection
- **ISOLATED world** (`content-isolated.js`) - handles the UI, SVG overlay, click capture, and bearing math. Communicates with the MAIN world script via `window.postMessage`

If the Maps API instance can't be found (it uses undocumented internals), the extension falls back to parsing the URL (`/@lat,lng,zoomz`) and doing Web Mercator projection math - accurate to within a few meters at typical zoom levels.

### Bearing formula

Uses the forward azimuth formula:

```
theta = atan2(
  sin(dlng) * cos(lat2),
  cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlng)
)
bearing = (theta + 360) % 360
```

### Distance formula

Haversine:

```
a = sin(dlat/2)^2 + cos(lat1) * cos(lat2) * sin(dlng/2)^2
c = 2 * atan2(sqrt(a), sqrt(1-a))
d = R * c    (R = 6,371,000 m)
```

## File structure

```
azimuth/
  manifest.json              # Chrome Manifest V3 config
  content/
    content-isolated.js      # UI, overlay, state machine, result display
    content-main.js          # Bridge to Google Maps API on the page
    content.css              # Styles for toolbar, overlay, result panel
  lib/
    geo.js                   # Bearing, distance, cardinal direction math
    projection.js            # Fallback Mercator projection from URL
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
