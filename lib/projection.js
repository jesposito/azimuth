const FallbackProjection = (() => {
  const TILE_SIZE = 256;

  /**
   * Parse Google Maps URL for center lat, lng, zoom.
   * Handles: /@lat,lng,zoomz
   */
  function parseMapURL(url) {
    const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2]),
        zoom: parseFloat(match[3])
      };
    }
    return null;
  }

  /**
   * Convert lat/lng to world pixel coordinates at given zoom.
   */
  function latLngToPixel(lat, lng, zoom) {
    const scale = Math.pow(2, zoom) * TILE_SIZE;
    const x = (lng + 180) / 360 * scale;
    const sinLat = Math.sin(lat * Math.PI / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  /**
   * Convert world pixel coordinates back to lat/lng.
   */
  function pixelToLatLng(px, py, zoom) {
    const scale = Math.pow(2, zoom) * TILE_SIZE;
    const lng = px / scale * 360 - 180;
    const n = Math.PI - 2 * Math.PI * py / scale;
    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lng };
  }

  /**
   * Convert a click position relative to the map container to lat/lng,
   * given the container dimensions and the map's center/zoom from the URL.
   */
  function containerPixelToLatLng(clickX, clickY, containerWidth, containerHeight, centerLat, centerLng, zoom) {
    const centerPixel = latLngToPixel(centerLat, centerLng, zoom);
    const worldX = centerPixel.x + (clickX - containerWidth / 2);
    const worldY = centerPixel.y + (clickY - containerHeight / 2);
    return pixelToLatLng(worldX, worldY, zoom);
  }

  /**
   * Convert a lat/lng back to container-relative pixel position.
   */
  function latLngToContainerPixel(lat, lng, containerWidth, containerHeight, centerLat, centerLng, zoom) {
    const centerPixel = latLngToPixel(centerLat, centerLng, zoom);
    const pointPixel = latLngToPixel(lat, lng, zoom);
    return {
      x: (pointPixel.x - centerPixel.x) + containerWidth / 2,
      y: (pointPixel.y - centerPixel.y) + containerHeight / 2
    };
  }

  return { parseMapURL, latLngToPixel, pixelToLatLng, containerPixelToLatLng, latLngToContainerPixel };
})();
