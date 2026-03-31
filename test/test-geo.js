const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module');

const { BearingGeo } = loadModule('lib/geo.js');

// Helper: assert bearing is within tolerance degrees
function assertBearing(actual, expected, tolerance, msg) {
  // Handle wrap-around (e.g., 359 vs 1 should be 2 degrees apart)
  let diff = Math.abs(actual - expected);
  if (diff > 180) diff = 360 - diff;
  assert.ok(diff <= tolerance, `${msg}: expected ~${expected}, got ${actual} (diff ${diff.toFixed(2)})`);
}

function assertClose(actual, expected, tolerance, msg) {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance, `${msg}: expected ~${expected}, got ${actual} (diff ${diff.toFixed(4)})`);
}

describe('BearingGeo.bearing()', () => {
  it('returns a number', () => {
    const b = BearingGeo.bearing(0, 0, 1, 1);
    assert.equal(typeof b, 'number');
  });

  it('due north = 0 degrees', () => {
    const b = BearingGeo.bearing(0, 0, 10, 0);
    assertBearing(b, 0, 0.1, 'Due north');
  });

  it('due south = 180 degrees', () => {
    const b = BearingGeo.bearing(10, 0, 0, 0);
    assertBearing(b, 180, 0.1, 'Due south');
  });

  it('due east from equator = 90 degrees', () => {
    const b = BearingGeo.bearing(0, 0, 0, 10);
    assertBearing(b, 90, 0.1, 'Due east');
  });

  it('due west from equator = 270 degrees', () => {
    const b = BearingGeo.bearing(0, 0, 0, -10);
    assertBearing(b, 270, 0.1, 'Due west');
  });

  it('northeast = ~45 degrees from equator', () => {
    // On equator, 1 degree lat ~ 1 degree lng in distance, so bearing should be ~45
    const b = BearingGeo.bearing(0, 0, 1, 1);
    assertBearing(b, 45, 1, 'NE from equator');
  });

  it('JFK to LHR ~ 51 degrees (reference)', () => {
    // JFK: 40.6413, -73.7781  LHR: 51.4700, -0.4543
    const b = BearingGeo.bearing(40.6413, -73.7781, 51.4700, -0.4543);
    assertBearing(b, 51, 2, 'JFK to LHR');
  });

  it('NYC to LA ~ 274 degrees (reference)', () => {
    // NYC: 40.7128, -74.0060  LA: 34.0522, -118.2437
    const b = BearingGeo.bearing(40.7128, -74.0060, 34.0522, -118.2437);
    assertBearing(b, 274, 2, 'NYC to LA');
  });

  it('Sydney to Tokyo ~ 350 degrees', () => {
    // Sydney: -33.8688, 151.2093  Tokyo: 35.6762, 139.6503
    const b = BearingGeo.bearing(-33.8688, 151.2093, 35.6762, 139.6503);
    assertBearing(b, 350, 3, 'Sydney to Tokyo');
  });

  it('same point returns 0', () => {
    const b = BearingGeo.bearing(40.0, -74.0, 40.0, -74.0);
    // Same point - bearing is technically undefined but should return 0
    assert.equal(typeof b, 'number');
    assert.ok(!isNaN(b), 'Should not be NaN for same point');
  });

  it('result is always in [0, 360)', () => {
    const testCases = [
      [0, 0, 45, 90],
      [0, 0, -45, -90],
      [89.9, 0, -89.9, 180],
      [0, 179, 0, -179],
      [-33, 151, 35, 139],
    ];
    for (const [lat1, lng1, lat2, lng2] of testCases) {
      const b = BearingGeo.bearing(lat1, lng1, lat2, lng2);
      assert.ok(b >= 0 && b < 360, `Bearing ${b} out of [0,360) for (${lat1},${lng1}) -> (${lat2},${lng2})`);
    }
  });

  it('reverse bearing is ~180 degrees opposite for short distance', () => {
    // Use a short distance where forward/reverse initial bearings ARE close to 180 apart
    // (For long great circle arcs, they diverge significantly - that's correct geodesy)
    const fwd = BearingGeo.bearing(40.7, -74.0, 40.8, -73.9);
    const rev = BearingGeo.bearing(40.8, -73.9, 40.7, -74.0);
    let diff = Math.abs(fwd - rev);
    if (diff > 180) diff = 360 - diff;
    assert.ok(diff > 175 && diff < 185, `Short-distance forward/reverse diff should be ~180, got ${diff}`);
  });

  it('handles north pole destination', () => {
    const b = BearingGeo.bearing(40, -74, 89.999, 0);
    assertBearing(b, 0, 10, 'To near north pole');
  });

  it('handles south pole destination', () => {
    const b = BearingGeo.bearing(40, -74, -89.999, 0);
    assertBearing(b, 180, 10, 'To near south pole');
  });

  it('handles antimeridian crossing (positive to negative lng)', () => {
    const b = BearingGeo.bearing(0, 170, 0, -170);
    assertBearing(b, 90, 0.1, 'East across antimeridian');
  });

  it('handles antimeridian crossing (negative to positive lng)', () => {
    const b = BearingGeo.bearing(0, -170, 0, 170);
    assertBearing(b, 270, 0.1, 'West across antimeridian');
  });
});

describe('BearingGeo.distance()', () => {
  it('returns a number', () => {
    const d = BearingGeo.distance(0, 0, 1, 1);
    assert.equal(typeof d, 'number');
  });

  it('same point = 0 meters', () => {
    const d = BearingGeo.distance(40, -74, 40, -74);
    assert.equal(d, 0);
  });

  it('1 degree latitude ~ 111 km', () => {
    const d = BearingGeo.distance(0, 0, 1, 0);
    assertClose(d / 1000, 111.19, 1, '1 degree lat distance');
  });

  it('1 degree longitude at equator ~ 111 km', () => {
    const d = BearingGeo.distance(0, 0, 0, 1);
    assertClose(d / 1000, 111.19, 1, '1 degree lng at equator');
  });

  it('1 degree longitude at 60N ~ 55.5 km', () => {
    const d = BearingGeo.distance(60, 0, 60, 1);
    assertClose(d / 1000, 55.6, 1, '1 degree lng at 60N');
  });

  it('JFK to LHR ~ 5,555 km', () => {
    const d = BearingGeo.distance(40.6413, -73.7781, 51.4700, -0.4543);
    assertClose(d / 1000, 5555, 50, 'JFK to LHR distance');
  });

  it('NYC to LA ~ 3,944 km', () => {
    const d = BearingGeo.distance(40.7128, -74.0060, 34.0522, -118.2437);
    assertClose(d / 1000, 3944, 50, 'NYC to LA distance');
  });

  it('distance is symmetric', () => {
    const d1 = BearingGeo.distance(40, -74, 51, -0.5);
    const d2 = BearingGeo.distance(51, -0.5, 40, -74);
    assertClose(d1, d2, 0.01, 'Distance symmetry');
  });

  it('result is always non-negative', () => {
    const pairs = [
      [0, 0, 0, 0],
      [90, 0, -90, 0],
      [0, 180, 0, -180],
      [-33, 151, 35, 139],
    ];
    for (const [lat1, lng1, lat2, lng2] of pairs) {
      const d = BearingGeo.distance(lat1, lng1, lat2, lng2);
      assert.ok(d >= 0, `Distance should be non-negative, got ${d}`);
    }
  });

  it('antipodal points ~ 20,015 km (half circumference)', () => {
    const d = BearingGeo.distance(0, 0, 0, 180);
    assertClose(d / 1000, 20015, 20, 'Half circumference');
  });

  it('handles antimeridian crossing', () => {
    const d = BearingGeo.distance(0, 170, 0, -170);
    assertClose(d / 1000, 2224, 20, 'Antimeridian crossing');
  });
});

describe('BearingGeo.cardinalDirection()', () => {
  it('0 degrees = N', () => {
    assert.equal(BearingGeo.cardinalDirection(0), 'N');
  });

  it('90 degrees = E', () => {
    assert.equal(BearingGeo.cardinalDirection(90), 'E');
  });

  it('180 degrees = S', () => {
    assert.equal(BearingGeo.cardinalDirection(180), 'S');
  });

  it('270 degrees = W', () => {
    assert.equal(BearingGeo.cardinalDirection(270), 'W');
  });

  it('45 degrees = NE', () => {
    assert.equal(BearingGeo.cardinalDirection(45), 'NE');
  });

  it('360 degrees wraps to N', () => {
    assert.equal(BearingGeo.cardinalDirection(360), 'N');
  });

  it('all 16 cardinal points', () => {
    const expected = [
      [0, 'N'], [22.5, 'NNE'], [45, 'NE'], [67.5, 'ENE'],
      [90, 'E'], [112.5, 'ESE'], [135, 'SE'], [157.5, 'SSE'],
      [180, 'S'], [202.5, 'SSW'], [225, 'SW'], [247.5, 'WSW'],
      [270, 'W'], [292.5, 'WNW'], [315, 'NW'], [337.5, 'NNW'],
    ];
    for (const [deg, dir] of expected) {
      assert.equal(BearingGeo.cardinalDirection(deg), dir, `${deg} should be ${dir}`);
    }
  });

  it('values just under boundary round correctly', () => {
    // 11.24 should round to N (0), 11.26 should round to NNE (22.5)
    assert.equal(BearingGeo.cardinalDirection(11.24), 'N');
    assert.equal(BearingGeo.cardinalDirection(11.26), 'NNE');
  });
});

describe('BearingGeo.formatDistance()', () => {
  it('formats meters under 1000', () => {
    assert.equal(BearingGeo.formatDistance(500), '500 m');
  });

  it('formats exact meter values', () => {
    assert.equal(BearingGeo.formatDistance(0), '0 m');
    assert.equal(BearingGeo.formatDistance(1), '1 m');
    assert.equal(BearingGeo.formatDistance(999), '999 m');
  });

  it('formats km with decimals under 100km', () => {
    assert.equal(BearingGeo.formatDistance(1000), '1.00 km');
    assert.equal(BearingGeo.formatDistance(1500), '1.50 km');
    assert.equal(BearingGeo.formatDistance(99999), '100.00 km');
  });

  it('formats large distances as whole km', () => {
    assert.equal(BearingGeo.formatDistance(100000), '100 km');
    assert.equal(BearingGeo.formatDistance(5555000), '5555 km');
  });

  it('rounds meters to nearest integer', () => {
    assert.equal(BearingGeo.formatDistance(500.7), '501 m');
    assert.equal(BearingGeo.formatDistance(500.2), '500 m');
  });
});
