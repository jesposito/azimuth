(function() {
  'use strict';

  let mapInstance = null;
  let bridgeNonce = null;

  function findMapInstance() {
    // Strategy 0: Check for gmp-map web component (documented API, forward-compatible)
    const gmpMap = document.querySelector('gmp-map');
    if (gmpMap && gmpMap.innerMap) return gmpMap.innerMap;

    // Strategy 1: Walk up from .gm-style to find __gm property
    const gmStyle = document.querySelector('.gm-style');
    if (gmStyle) {
      let el = gmStyle;
      while (el) {
        if (el.__gm && el.__gm.map) return el.__gm.map;
        el = el.parentElement;
      }
    }

    // Strategy 2: Check known container IDs and roles
    const containers = document.querySelectorAll(
      '#map-canvas, #map, [role="application"], [aria-label="Map"], #scene, .widget-scene'
    );
    for (const container of containers) {
      if (container.__gm && container.__gm.map) return container.__gm.map;
      // Walk children looking for __gm
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.__gm && node.__gm.map) return node.__gm.map;
      }
    }

    // Strategy 3: Brute-force walk from body (limited depth to avoid perf issues)
    function searchDepth(el, depth) {
      if (depth > 6) return null;
      if (el.__gm && el.__gm.map) return el.__gm.map;
      for (const child of el.children) {
        const found = searchDepth(child, depth + 1);
        if (found) return found;
      }
      return null;
    }
    return searchDepth(document.body, 0);
  }

  let dummyOverlay = null;

  function getOrCreateOverlay(map) {
    if (dummyOverlay && dummyOverlay.getMap() === map) {
      return dummyOverlay;
    }
    class DummyOverlay extends google.maps.OverlayView {
      onAdd() {}
      draw() {}
      onRemove() {}
    }
    dummyOverlay = new DummyOverlay();
    dummyOverlay.setMap(map);
    return dummyOverlay;
  }

  // Handle pixel-to-latlng conversion requests
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    // Nonce validation
    if (event.data?.nonce) {
      if (!bridgeNonce) {
        bridgeNonce = event.data.nonce; // learn nonce from first message
      } else if (event.data.nonce !== bridgeNonce) {
        return; // reject mismatched nonce
      }
    }

    if (event.data?.type === 'BEARING_EXT_PIXEL_TO_LATLNG') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({
          type: 'BEARING_EXT_LATLNG_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: 'MAP_NOT_FOUND'
        }, window.location.origin);
        return;
      }
      mapInstance = map;

      try {
        const overlay = getOrCreateOverlay(map);
        const proj = overlay.getProjection();
        if (!proj) throw new Error('Overlay projection not ready');

        const latLng = proj.fromContainerPixelToLatLng(
          new google.maps.Point(event.data.x, event.data.y)
        );

        window.postMessage({
          type: 'BEARING_EXT_LATLNG_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          lat: latLng.lat(),
          lng: latLng.lng()
        }, window.location.origin);
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_LATLNG_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: err.message
        }, window.location.origin);
      }
    }

    if (event.data?.type === 'BEARING_EXT_GET_MAP_STATE') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({
          type: 'BEARING_EXT_MAP_STATE',
          nonce: bridgeNonce,
          error: 'MAP_NOT_FOUND'
        }, window.location.origin);
        return;
      }
      mapInstance = map;

      try {
        const center = map.getCenter();
        window.postMessage({
          type: 'BEARING_EXT_MAP_STATE',
          nonce: bridgeNonce,
          center: { lat: center.lat(), lng: center.lng() },
          zoom: map.getZoom(),
          heading: map.getHeading() || 0
        }, window.location.origin);
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_MAP_STATE',
          nonce: bridgeNonce,
          error: err.message
        }, window.location.origin);
      }
    }

    // Convert lat/lng back to container pixel for repositioning
    if (event.data?.type === 'BEARING_EXT_LATLNG_TO_PIXEL') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({
          type: 'BEARING_EXT_PIXEL_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: 'MAP_NOT_FOUND'
        }, window.location.origin);
        return;
      }
      mapInstance = map;

      try {
        const overlay = getOrCreateOverlay(map);
        const proj = overlay.getProjection();
        if (!proj) throw new Error('Overlay projection not ready');

        const pixel = proj.fromLatLngToContainerPixel(
          new google.maps.LatLng(event.data.lat, event.data.lng)
        );

        window.postMessage({
          type: 'BEARING_EXT_PIXEL_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          x: pixel.x,
          y: pixel.y
        }, window.location.origin);
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_PIXEL_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: err.message
        }, window.location.origin);
      }
    }

    if (event.data?.type === 'BEARING_EXT_GEOCODE') {
      try {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: event.data.query }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
            const location = results[0].geometry.location;
            window.postMessage({
              type: 'BEARING_EXT_GEOCODE_RESULT',
              requestId: event.data.requestId,
              nonce: bridgeNonce,
              lat: location.lat(),
              lng: location.lng(),
              formattedAddress: results[0].formatted_address
            }, window.location.origin);
          } else {
            window.postMessage({
              type: 'BEARING_EXT_GEOCODE_RESULT',
              requestId: event.data.requestId,
              nonce: bridgeNonce,
              error: status || 'GEOCODE_FAILED'
            }, window.location.origin);
          }
        });
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_GEOCODE_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: err.message
        }, window.location.origin);
      }
    }

    if (event.data?.type === 'BEARING_EXT_PLACES_AUTOCOMPLETE') {
      try {
        const service = new google.maps.places.AutocompleteService();
        service.getPlacePredictions({ input: event.data.input }, (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            window.postMessage({
              type: 'BEARING_EXT_AUTOCOMPLETE_RESULT',
              requestId: event.data.requestId,
              nonce: bridgeNonce,
              predictions: predictions.map(p => ({
                description: p.description,
                placeId: p.place_id
              }))
            }, window.location.origin);
          } else {
            window.postMessage({
              type: 'BEARING_EXT_AUTOCOMPLETE_RESULT',
              requestId: event.data.requestId,
              nonce: bridgeNonce,
              error: status || 'AUTOCOMPLETE_FAILED'
            }, window.location.origin);
          }
        });
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_AUTOCOMPLETE_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: err.message
        }, window.location.origin);
      }
    }

    if (event.data?.type === 'BEARING_EXT_PLACE_DETAILS') {
      const map = mapInstance || findMapInstance();
      if (!map) {
        window.postMessage({
          type: 'BEARING_EXT_PLACE_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: 'MAP_NOT_FOUND'
        }, window.location.origin);
        return;
      }
      mapInstance = map;

      try {
        const service = new google.maps.places.PlacesService(map.getDiv());
        service.getDetails(
          { placeId: event.data.placeId, fields: ['geometry', 'name'] },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              const location = place.geometry.location;
              window.postMessage({
                type: 'BEARING_EXT_PLACE_RESULT',
                requestId: event.data.requestId,
                nonce: bridgeNonce,
                lat: location.lat(),
                lng: location.lng(),
                name: place.name
              }, window.location.origin);
            } else {
              window.postMessage({
                type: 'BEARING_EXT_PLACE_RESULT',
                requestId: event.data.requestId,
                nonce: bridgeNonce,
                error: status || 'PLACE_DETAILS_FAILED'
              }, window.location.origin);
            }
          }
        );
      } catch (err) {
        window.postMessage({
          type: 'BEARING_EXT_PLACE_RESULT',
          requestId: event.data.requestId,
          nonce: bridgeNonce,
          error: err.message
        }, window.location.origin);
      }
    }
  });
})();
