const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module');

const { FallbackProjection } = loadModule('lib/projection.js');

function assertClose(actual, expected, tolerance, msg) {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance, `${msg}: expected ~${expected}, got ${actual} (diff ${diff.toFixed(6)})`);
}

describe('FallbackProjection.parseMapURL()', () => {
  it('parses standard Maps URL', () => {
    const result = FallbackProjection.parseMapURL('https://www.google.com/maps/@40.7128,-74.0060,12z');
    assert.ok(result !== null, 'Should parse successfully');
    assertClose(result.lat, 40.7128, 0.0001, 'Lat');
    assertClose(result.lng, -74.006, 0.0001, 'Lng');
    assert.equal(result.zoom, 12);
  });

  it('parses high zoom level', () => {
    const result = FallbackProjection.parseMapURL('https://www.google.com/maps/@51.5074,-0.1278,18z');
    assert.equal(result.zoom, 18);
  });

  it('parses fractional zoom', () => {
    const result = FallbackProjection.parseMapURL('https://www.google.com/maps/@40.7,-74.0,14.5z');
    assert.equal(result.zoom, 14.5);
  });

  it('parses negative lat/lng', () => {
    const result = FallbackProjection.parseMapURL('https://www.google.com/maps/@-33.8688,151.2093,10z');
    assertClose(result.lat, -33.8688, 0.001, 'Negative lat');
    assertClose(result.lng, 151.2093, 0.001, 'Positive lng');
  });

  it('returns null for non-matching URLs', () => {
    assert.equal(FallbackProjection.parseMapURL('https://www.google.com/maps/place/foo'), null);
    assert.equal(FallbackProjection.parseMapURL('https://example.com'), null);
    assert.equal(FallbackProjection.parseMapURL(''), null);
  });

  it('parses URL with additional path segments', () => {
    const result = FallbackProjection.parseMapURL('https://www.google.com/maps/@40.7128,-74.0060,12z/data=!3m1!1e3');
    assert.ok(result !== null);
    assertClose(result.lat, 40.7128, 0.001, 'Lat with extra path');
  });

  it('parses whole number coordinates', () => {
    const result = FallbackProjection.parseMapURL('https://www.google.com/maps/@40,-74,10z');
    assert.equal(result.lat, 40);
    assert.equal(result.lng, -74);
  });
});

describe('FallbackProjection.latLngToPixel() / pixelToLatLng() round-trip', () => {
  const testCases = [
    { lat: 0, lng: 0, zoom: 10, name: 'origin' },
    { lat: 40.7128, lng: -74.0060, zoom: 12, name: 'NYC' },
    { lat: -33.8688, lng: 151.2093, zoom: 14, name: 'Sydney' },
    { lat: 51.5074, lng: -0.1278, zoom: 8, name: 'London' },
    { lat: 35.6762, lng: 139.6503, zoom: 16, name: 'Tokyo' },
    { lat: 0, lng: 179.9, zoom: 5, name: 'near antimeridian' },
    { lat: 0, lng: -179.9, zoom: 5, name: 'near antimeridian negative' },
    { lat: 85, lng: 0, zoom: 3, name: 'near north pole' },
    { lat: -85, lng: 0, zoom: 3, name: 'near south pole' },
  ];

  for (const tc of testCases) {
    it(`round-trip at ${tc.name} (${tc.lat}, ${tc.lng}, z${tc.zoom})`, () => {
      const px = FallbackProjection.latLngToPixel(tc.lat, tc.lng, tc.zoom);
      const result = FallbackProjection.pixelToLatLng(px.x, px.y, tc.zoom);
      assertClose(result.lat, tc.lat, 0.0001, `Lat round-trip at ${tc.name}`);
      assertClose(result.lng, tc.lng, 0.0001, `Lng round-trip at ${tc.name}`);
    });
  }

  it('pixel values increase with zoom', () => {
    const px10 = FallbackProjection.latLngToPixel(40, -74, 10);
    const px15 = FallbackProjection.latLngToPixel(40, -74, 15);
    assert.ok(px15.x > px10.x, 'Higher zoom = larger pixel X');
    assert.ok(px15.y > px10.y, 'Higher zoom = larger pixel Y');
  });

  it('equator maps to middle of Y axis', () => {
    const px = FallbackProjection.latLngToPixel(0, 0, 1);
    const scale = Math.pow(2, 1) * 256;
    assertClose(px.y, scale / 2, 1, 'Equator at Y midpoint');
  });

  it('prime meridian maps to middle of X axis', () => {
    const px = FallbackProjection.latLngToPixel(0, 0, 1);
    const scale = Math.pow(2, 1) * 256;
    assertClose(px.x, scale / 2, 1, 'Prime meridian at X midpoint');
  });
});

describe('FallbackProjection.containerPixelToLatLng() / latLngToContainerPixel() round-trip', () => {
  const containerW = 800;
  const containerH = 600;
  const centerLat = 40.7128;
  const centerLng = -74.0060;
  const zoom = 12;

  it('center click returns center lat/lng', () => {
    const result = FallbackProjection.containerPixelToLatLng(
      containerW / 2, containerH / 2, containerW, containerH, centerLat, centerLng, zoom
    );
    assertClose(result.lat, centerLat, 0.001, 'Center lat');
    assertClose(result.lng, centerLng, 0.001, 'Center lng');
  });

  it('round-trip: containerPixelToLatLng -> latLngToContainerPixel', () => {
    const clickX = 200;
    const clickY = 150;
    const latLng = FallbackProjection.containerPixelToLatLng(
      clickX, clickY, containerW, containerH, centerLat, centerLng, zoom
    );
    const pixel = FallbackProjection.latLngToContainerPixel(
      latLng.lat, latLng.lng, containerW, containerH, centerLat, centerLng, zoom
    );
    assertClose(pixel.x, clickX, 0.5, 'X round-trip');
    assertClose(pixel.y, clickY, 0.5, 'Y round-trip');
  });

  it('round-trip works at container corners', () => {
    const corners = [[0, 0], [containerW, 0], [0, containerH], [containerW, containerH]];
    for (const [x, y] of corners) {
      const latLng = FallbackProjection.containerPixelToLatLng(
        x, y, containerW, containerH, centerLat, centerLng, zoom
      );
      const pixel = FallbackProjection.latLngToContainerPixel(
        latLng.lat, latLng.lng, containerW, containerH, centerLat, centerLng, zoom
      );
      assertClose(pixel.x, x, 0.5, `Corner (${x},${y}) X round-trip`);
      assertClose(pixel.y, y, 0.5, `Corner (${x},${y}) Y round-trip`);
    }
  });

  it('clicking right of center gives higher longitude', () => {
    const left = FallbackProjection.containerPixelToLatLng(
      100, containerH / 2, containerW, containerH, centerLat, centerLng, zoom
    );
    const right = FallbackProjection.containerPixelToLatLng(
      700, containerH / 2, containerW, containerH, centerLat, centerLng, zoom
    );
    assert.ok(right.lng > left.lng, 'Right of center = higher longitude');
  });

  it('clicking above center gives higher latitude', () => {
    const top = FallbackProjection.containerPixelToLatLng(
      containerW / 2, 100, containerW, containerH, centerLat, centerLng, zoom
    );
    const bottom = FallbackProjection.containerPixelToLatLng(
      containerW / 2, 500, containerW, containerH, centerLat, centerLng, zoom
    );
    assert.ok(top.lat > bottom.lat, 'Above center = higher latitude');
  });

  it('different zoom levels produce different lat/lng for same pixel', () => {
    const z10 = FallbackProjection.containerPixelToLatLng(
      200, 200, containerW, containerH, centerLat, centerLng, 10
    );
    const z14 = FallbackProjection.containerPixelToLatLng(
      200, 200, containerW, containerH, centerLat, centerLng, 14
    );
    // Higher zoom = smaller area, so offset from center should be smaller
    const distZ10 = Math.abs(z10.lat - centerLat) + Math.abs(z10.lng - centerLng);
    const distZ14 = Math.abs(z14.lat - centerLat) + Math.abs(z14.lng - centerLng);
    assert.ok(distZ14 < distZ10, 'Higher zoom = smaller geographic offset from center');
  });
});
