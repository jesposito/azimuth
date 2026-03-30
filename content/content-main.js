(function() {
  'use strict';

  let mapInstance = null;

  function findMapInstance() {
    // Strategy 1: Look for the gm-style container and walk up to find __gm
    const gmStyle = document.querySelector('.gm-style');
    if (gmStyle) {
      let el = gmStyle.parentElement;
      while (el) {
        if (el.__gm && el.__gm.map) return el.__gm.map;
        el = el.parentElement;
      }
    }

    // Strategy 2: Check known container IDs
    const containers = document.querySelectorAll('#map-canvas, #map, [role="application"]');
    for (const container of containers) {
      if (container.__gm && container.__gm.map) return container.__gm.map;
      // Check children
      const inner = container.querySelector('.gm-style');
      if (inner) {
        let el = inner.parentElement;
        while (el && el !== container.parentElement) {
          if (el.__gm && el.__gm.map) return el.__gm.map;
          el = el.parentElement;
        }
      }
    }

    return null;
  }

  // Handle pixel-to-latlng conversion requests
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'BEARING_EXT_PIXEL_TO_LATLNG') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({
          type: 'BEARING_EXT_LATLNG_RESULT',
          requestId: event.data.requestId,
          error: 'MAP_NOT_FOUND'
        }, '*');
        return;
      }
      mapInstance = map;

      try {
        const projection = map.getProjection();
        if (!projection) throw new Error('No projection');

        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const topRight = projection.fromLatLngToPoint(ne);
        const bottomLeft = projection.fromLatLngToPoint(sw);
        // Handle world wrap
        let worldWidth = topRight.x - bottomLeft.x;
        if (worldWidth < 0) worldWidth += 256;

        const mapDiv = map.getDiv();
        const rect = mapDiv.getBoundingClientRect();

        // Click position as fraction of container
        const fracX = event.data.x / rect.width;
        const fracY = event.data.y / rect.height;

        // World coordinate of the click
        const worldX = bottomLeft.x + fracX * worldWidth;
        const worldY = topRight.y + fracY * (bottomLeft.y - topRight.y);

        const worldPoint = new google.maps.Point(worldX, worldY);
        const latLng = projection.fromPointToLatLng(worldPoint);

        window.postMessage({
          type: 'BEARING_EXT_LATLNG_RESULT',
          requestId: event.data.requestId,
          lat: latLng.lat(),
          lng: latLng.lng()
        }, '*');
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_LATLNG_RESULT',
          requestId: event.data.requestId,
          error: err.message
        }, '*');
      }
    }

    if (event.data?.type === 'BEARING_EXT_GET_MAP_STATE') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({ type: 'BEARING_EXT_MAP_STATE', error: 'MAP_NOT_FOUND' }, '*');
        return;
      }
      mapInstance = map;

      try {
        const center = map.getCenter();
        window.postMessage({
          type: 'BEARING_EXT_MAP_STATE',
          center: { lat: center.lat(), lng: center.lng() },
          zoom: map.getZoom(),
          heading: map.getHeading() || 0
        }, '*');
      } catch (err) {
        window.postMessage({ type: 'BEARING_EXT_MAP_STATE', error: err.message }, '*');
      }
    }

    // Convert lat/lng back to container pixel for repositioning
    if (event.data?.type === 'BEARING_EXT_LATLNG_TO_PIXEL') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({
          type: 'BEARING_EXT_PIXEL_RESULT',
          requestId: event.data.requestId,
          error: 'MAP_NOT_FOUND'
        }, '*');
        return;
      }
      mapInstance = map;

      try {
        const projection = map.getProjection();
        if (!projection) throw new Error('No projection');

        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const topRight = projection.fromLatLngToPoint(ne);
        const bottomLeft = projection.fromLatLngToPoint(sw);

        let worldWidth = topRight.x - bottomLeft.x;
        if (worldWidth < 0) worldWidth += 256;

        const point = projection.fromLatLngToPoint(
          new google.maps.LatLng(event.data.lat, event.data.lng)
        );

        const mapDiv = map.getDiv();
        const rect = mapDiv.getBoundingClientRect();

        let dx = point.x - bottomLeft.x;
        if (dx < 0) dx += 256;

        const x = (dx / worldWidth) * rect.width;
        const y = ((point.y - topRight.y) / (bottomLeft.y - topRight.y)) * rect.height;

        window.postMessage({
          type: 'BEARING_EXT_PIXEL_RESULT',
          requestId: event.data.requestId,
          x, y
        }, '*');
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_PIXEL_RESULT',
          requestId: event.data.requestId,
          error: err.message
        }, '*');
      }
    }
  });
})();
