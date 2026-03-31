/**
 * Integration tests that combine multiple modules together,
 * testing the data flow as it would work in the real extension.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module');

const { BearingGeo } = loadModule('lib/geo.js');
const { FallbackProjection } = loadModule('lib/projection.js');
const { MagDeclination } = loadModule('lib/declination.js');

function assertClose(actual, expected, tolerance, msg) {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance, `${msg}: expected ~${expected}, got ${actual} (diff ${diff.toFixed(4)})`);
}

describe('End-to-end: click -> bearing -> display', () => {
  // Simulates the full flow: user clicks two points on the map,
  // we convert pixels to lat/lng, compute bearing/distance/declination

  const containerW = 1024;
  const containerH = 768;
  const centerLat = 40.7128;
  const centerLng = -74.0060;
  const zoom = 12;

  it('two clicks produce valid bearing and distance', () => {
    // Click near top-left
    const start = FallbackProjection.containerPixelToLatLng(
      300, 200, containerW, containerH, centerLat, centerLng, zoom
    );
    // Click near bottom-right
    const end = FallbackProjection.containerPixelToLatLng(
      700, 500, containerW, containerH, centerLat, centerLng, zoom
    );

    const bearing = BearingGeo.bearing(start.lat, start.lng, end.lat, end.lng);
    const distance = BearingGeo.distance(start.lat, start.lng, end.lat, end.lng);
    const cardinal = BearingGeo.cardinalDirection(bearing);
    const decl = MagDeclination.getDeclination(
      (start.lat + end.lat) / 2,
      (start.lng + end.lng) / 2
    );
    const magBearing = ((bearing - decl) + 360) % 360;

    assert.ok(bearing >= 0 && bearing < 360, 'Bearing in range');
    assert.ok(distance > 0, 'Distance positive');
    assert.ok(typeof cardinal === 'string' && cardinal.length > 0, 'Cardinal direction exists');
    assert.ok(typeof decl === 'number' && isFinite(decl), 'Declination is finite');
    assert.ok(magBearing >= 0 && magBearing < 360, 'Magnetic bearing in range');

    // Since we clicked SE of center, bearing should be roughly SE
    assert.ok(bearing > 90 && bearing < 270, `Bearing ${bearing} should be roughly SE for this click pattern`);
  });

  it('same pixel clicked twice produces zero distance', () => {
    const point = FallbackProjection.containerPixelToLatLng(
      500, 400, containerW, containerH, centerLat, centerLng, zoom
    );
    const distance = BearingGeo.distance(point.lat, point.lng, point.lat, point.lng);
    assert.equal(distance, 0);
  });

  it('multi-leg route: total distance = sum of legs', () => {
    const points = [
      { x: 200, y: 200 },
      { x: 500, y: 300 },
      { x: 700, y: 500 },
      { x: 300, y: 600 },
    ].map(p => FallbackProjection.containerPixelToLatLng(
      p.x, p.y, containerW, containerH, centerLat, centerLng, zoom
    ));

    let totalDist = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const d = BearingGeo.distance(
        points[i].lat, points[i].lng,
        points[i + 1].lat, points[i + 1].lng
      );
      assert.ok(d > 0, `Leg ${i} should have positive distance`);
      totalDist += d;
    }
    assert.ok(totalDist > 0, 'Total distance should be positive');

    // Direct distance should be less than or equal to total route distance
    const directDist = BearingGeo.distance(
      points[0].lat, points[0].lng,
      points[points.length - 1].lat, points[points.length - 1].lng
    );
    assert.ok(directDist <= totalDist, 'Direct distance <= sum of legs (triangle inequality)');
  });

  it('drag simulation: moving a point updates bearing smoothly', () => {
    const startLatLng = FallbackProjection.containerPixelToLatLng(
      300, 400, containerW, containerH, centerLat, centerLng, zoom
    );

    const bearings = [];
    // Simulate dragging end point rightward
    for (let x = 500; x <= 800; x += 50) {
      const endLatLng = FallbackProjection.containerPixelToLatLng(
        x, 400, containerW, containerH, centerLat, centerLng, zoom
      );
      bearings.push(BearingGeo.bearing(startLatLng.lat, startLatLng.lng, endLatLng.lat, endLatLng.lng));
    }

    // All bearings should be roughly east (close to 90) and change gradually
    for (let i = 0; i < bearings.length; i++) {
      assertClose(bearings[i], 90, 5, `Drag step ${i} should be ~90 east`);
    }

    // Consecutive bearings should differ by small amounts
    for (let i = 1; i < bearings.length; i++) {
      const diff = Math.abs(bearings[i] - bearings[i - 1]);
      assert.ok(diff < 5, `Bearing jump between steps ${i - 1} and ${i}: ${diff} degrees`);
    }
  });
});

describe('End-to-end: projection round-trips with bearing', () => {
  it('place two lat/lng points, project to pixels, re-project back, bearing preserved', () => {
    const containerW = 1024;
    const containerH = 768;
    const centerLat = 51.5074;
    const centerLng = -0.1278;
    const zoom = 10;

    const pointA = { lat: 51.6, lng: -0.2 };
    const pointB = { lat: 51.4, lng: 0.1 };

    // Compute original bearing
    const origBearing = BearingGeo.bearing(pointA.lat, pointA.lng, pointB.lat, pointB.lng);

    // Project to pixels then back
    const pxA = FallbackProjection.latLngToContainerPixel(
      pointA.lat, pointA.lng, containerW, containerH, centerLat, centerLng, zoom
    );
    const pxB = FallbackProjection.latLngToContainerPixel(
      pointB.lat, pointB.lng, containerW, containerH, centerLat, centerLng, zoom
    );
    const backA = FallbackProjection.containerPixelToLatLng(
      pxA.x, pxA.y, containerW, containerH, centerLat, centerLng, zoom
    );
    const backB = FallbackProjection.containerPixelToLatLng(
      pxB.x, pxB.y, containerW, containerH, centerLat, centerLng, zoom
    );

    // Recompute bearing from round-tripped coordinates
    const backBearing = BearingGeo.bearing(backA.lat, backA.lng, backB.lat, backB.lng);

    assertClose(backBearing, origBearing, 0.01, 'Bearing preserved through projection round-trip');
  });
});

describe('End-to-end: magnetic bearing consistency', () => {
  it('magnetic bearing = true bearing - declination (mod 360)', () => {
    const lat1 = 40.7, lng1 = -74.0;
    const lat2 = 41.0, lng2 = -73.5;

    const trueBearing = BearingGeo.bearing(lat1, lng1, lat2, lng2);
    const decl = MagDeclination.getDeclination(
      (lat1 + lat2) / 2, (lng1 + lng2) / 2
    );
    const magBearing = ((trueBearing - decl) + 360) % 360;

    // Manual check
    const expected = ((trueBearing - decl) + 360) % 360;
    assertClose(magBearing, expected, 0.001, 'Magnetic bearing formula');
    assert.ok(magBearing >= 0 && magBearing < 360, 'In range');
  });

  it('declination signs are geographically consistent', () => {
    // Eastern US: declination is west (negative) -> mag bearing > true bearing
    const declNYC = MagDeclination.getDeclination(40.7, -74);
    assert.ok(declNYC < 0, 'NYC declination should be west (negative)');

    // Eastern Australia: declination is east (positive) -> mag bearing < true bearing
    const declSydney = MagDeclination.getDeclination(-33.9, 151.2);
    assert.ok(declSydney > 0, 'Sydney declination should be east (positive)');
  });
});

describe('Edge cases: extreme coordinates', () => {
  it('bearing from 0,0 to 0,180 (half world east)', () => {
    const b = BearingGeo.bearing(0, 0, 0, 180);
    assertClose(b, 90, 0.1, 'Due east halfway around');
  });

  it('distance across very small gap', () => {
    const d = BearingGeo.distance(40.71280, -74.00600, 40.71281, -74.00601);
    assert.ok(d > 0 && d < 5, `Very small distance: ${d}m`);
  });

  it('formatDistance handles sub-meter', () => {
    const d = BearingGeo.distance(40.712800, -74.006000, 40.712801, -74.006001);
    const formatted = BearingGeo.formatDistance(d);
    assert.ok(formatted.includes('m'), `Sub-meter format: ${formatted}`);
  });

  it('projection works at max/min zoom', () => {
    const px1 = FallbackProjection.latLngToPixel(40, -74, 1);
    const back1 = FallbackProjection.pixelToLatLng(px1.x, px1.y, 1);
    assertClose(back1.lat, 40, 0.01, 'Zoom 1 round-trip lat');

    const px20 = FallbackProjection.latLngToPixel(40, -74, 20);
    const back20 = FallbackProjection.pixelToLatLng(px20.x, px20.y, 20);
    assertClose(back20.lat, 40, 0.0001, 'Zoom 20 round-trip lat');
  });
});

describe('Copy text format', () => {
  // Test that the format used by copyResults() produces expected text

  it('single leg format is parseable', () => {
    const deg = 45.3;
    const cardinal = BearingGeo.cardinalDirection(deg);
    const dist = 1500;
    const magDeg = 57.8;
    const magCardinal = BearingGeo.cardinalDirection(magDeg);

    const line =
      'Bearing: ' + deg.toFixed(1) + '\u00B0 ' + cardinal + ' (true) / ' +
      magDeg.toFixed(1) + '\u00B0 ' + magCardinal + ' (mag)' +
      ' | Distance: ' + BearingGeo.formatDistance(dist) +
      ' | From: 40.71280,-74.00600' +
      ' | To: 41.00000,-73.50000';

    assert.ok(line.includes('45.3'), 'Contains bearing');
    assert.ok(line.includes('NE'), 'Contains cardinal');
    assert.ok(line.includes('1.50 km'), 'Contains distance');
    assert.ok(line.includes('(true)'), 'Contains true label');
    assert.ok(line.includes('(mag)'), 'Contains mag label');
  });
});
