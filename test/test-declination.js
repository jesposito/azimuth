const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module');

const { MagDeclination } = loadModule('lib/declination.js');

function assertClose(actual, expected, tolerance, msg) {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance, `${msg}: expected ~${expected}, got ${actual} (diff ${diff.toFixed(2)})`);
}

describe('MagDeclination.getDeclination()', () => {
  // Full WMM2020 model (orders 1-12, 168 coefficients) with secular variation.
  // All numeric tests pin dateDecimal=2025.0 for deterministic results.
  // Reference values verified against the NOAA wmm2020 Python package at 2025.0.
  //
  //   NYC:        -12.67 (NOAA wmm2020: -12.55)
  //   Denver:      +7.64 (NOAA wmm2020:  +7.56) -- positive (east)
  //   Tokyo:       -8.05 (NOAA wmm2020:  -7.96)
  //   Sydney:     +13.00 (NOAA wmm2020: +12.84)
  //   London:      +0.99 (NOAA wmm2020:  +1.01)
  //   Sao Paulo:  -21.98 (NOAA wmm2020: -21.94)

  it('returns a number', () => {
    const d = MagDeclination.getDeclination(40, -74);
    assert.equal(typeof d, 'number');
    assert.ok(!isNaN(d), 'Should not return NaN');
  });

  it('NYC area: declination ~ -12.7 degrees (west)', () => {
    const d = MagDeclination.getDeclination(40.7128, -74.006, 0, 2025.0);
    assertClose(d, -12.67, 1, 'NYC declination');
    assert.ok(d < 0, 'NYC declination should be negative (west)');
  });

  it('London area: declination ~ +1.0 degrees (east)', () => {
    const d = MagDeclination.getDeclination(51.5074, -0.1278, 0, 2025.0);
    assertClose(d, 0.99, 1, 'London declination');
  });

  it('Denver area: declination ~ +7.6 degrees (east)', () => {
    const d = MagDeclination.getDeclination(39.7392, -104.9903, 0, 2025.0);
    assertClose(d, 7.64, 1, 'Denver declination');
    assert.ok(d > 0, 'Denver declination should be positive (east)');
  });

  it('Tokyo area: declination ~ -8.1 degrees (west)', () => {
    const d = MagDeclination.getDeclination(35.6762, 139.6503, 0, 2025.0);
    assertClose(d, -8.05, 1, 'Tokyo declination');
  });

  it('Sydney area: declination ~ +13.0 degrees (east)', () => {
    const d = MagDeclination.getDeclination(-33.8688, 151.2093, 0, 2025.0);
    assertClose(d, 13.0, 1, 'Sydney declination');
    assert.ok(d > 0, 'Sydney declination should be positive (east)');
  });

  it('Sao Paulo area: declination ~ -22.0 degrees (west)', () => {
    const d = MagDeclination.getDeclination(-23.5505, -46.6333, 0, 2025.0);
    assertClose(d, -21.98, 1, 'Sao Paulo declination');
  });

  it('equator at prime meridian', () => {
    const d = MagDeclination.getDeclination(0, 0);
    assert.equal(typeof d, 'number');
    assert.ok(isFinite(d), 'Should be finite');
  });

  it('declination varies with latitude', () => {
    const d1 = MagDeclination.getDeclination(20, -80, 0, 2025.0);
    const d2 = MagDeclination.getDeclination(50, -80, 0, 2025.0);
    assert.ok(d1 !== d2, 'Declination should change with latitude');
  });

  it('declination varies with longitude', () => {
    const d1 = MagDeclination.getDeclination(40, -120, 0, 2025.0);
    const d2 = MagDeclination.getDeclination(40, -70, 0, 2025.0);
    assert.ok(d1 !== d2, 'Declination should change with longitude');
  });

  it('handles altitude parameter', () => {
    const d0 = MagDeclination.getDeclination(40, -74, 0, 2025.0);
    const d10 = MagDeclination.getDeclination(40, -74, 10, 2025.0);
    // At 10km altitude, declination should be slightly different
    assert.equal(typeof d10, 'number');
    assert.ok(!isNaN(d10), 'Should not return NaN at altitude');
    // Difference should be small (< 1 degree)
    assertClose(d0, d10, 1, 'Altitude effect is small');
  });

  it('handles dateDecimal parameter', () => {
    const d = MagDeclination.getDeclination(40, -74, 0, 2025.5);
    assert.equal(typeof d, 'number');
    assert.ok(!isNaN(d), 'Should not return NaN with dateDecimal');
  });

  it('handles near-pole latitudes without crashing', () => {
    // North pole area
    const dN = MagDeclination.getDeclination(89.5, 0);
    assert.equal(typeof dN, 'number');
    assert.ok(!isNaN(dN), 'Near north pole should not be NaN');
    assert.ok(isFinite(dN), 'Near north pole should be finite');

    // South pole area
    const dS = MagDeclination.getDeclination(-89.5, 0);
    assert.equal(typeof dS, 'number');
    assert.ok(!isNaN(dS), 'Near south pole should not be NaN');
    assert.ok(isFinite(dS), 'Near south pole should be finite');
  });

  it('handles exactly 90 degrees (pole singularity guard)', () => {
    const d = MagDeclination.getDeclination(90, 0);
    assert.equal(typeof d, 'number');
    assert.ok(isFinite(d), 'Exactly 90 should be finite (sinTheta guard)');
  });

  it('handles -90 degrees (south pole)', () => {
    const d = MagDeclination.getDeclination(-90, 0);
    assert.equal(typeof d, 'number');
    assert.ok(isFinite(d), 'Exactly -90 should be finite');
  });

  it('result is within reasonable range (-90 to 90)', () => {
    // Magnetic declination should never exceed ~90 degrees except near poles
    const testPoints = [
      [0, 0], [40, -74], [51, -0.1], [-33, 151],
      [35, 139], [60, 25], [-20, -43], [0, 90],
    ];
    for (const [lat, lng] of testPoints) {
      const d = MagDeclination.getDeclination(lat, lng);
      assert.ok(d >= -90 && d <= 90, `Declination ${d} out of range at (${lat}, ${lng})`);
    }
  });

  it('global sweep: no NaN or Infinity anywhere', () => {
    // Test a grid of points across the globe
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lng = -180; lng <= 180; lng += 30) {
        const d = MagDeclination.getDeclination(lat, lng);
        assert.ok(!isNaN(d), `NaN at (${lat}, ${lng})`);
        assert.ok(isFinite(d), `Infinite at (${lat}, ${lng})`);
      }
    }
  });
});

describe('MagDeclination.formatDeclination()', () => {
  it('positive declination shows E', () => {
    assert.equal(MagDeclination.formatDeclination(3.2), '3.2\u00b0 E');
  });

  it('negative declination shows W', () => {
    assert.equal(MagDeclination.formatDeclination(-12.5), '12.5\u00b0 W');
  });

  it('zero declination shows E', () => {
    assert.equal(MagDeclination.formatDeclination(0), '0.0\u00b0 E');
  });

  it('large declination formats correctly', () => {
    assert.equal(MagDeclination.formatDeclination(25.7), '25.7\u00b0 E');
    assert.equal(MagDeclination.formatDeclination(-30.1), '30.1\u00b0 W');
  });

  it('rounds to 1 decimal place', () => {
    assert.equal(MagDeclination.formatDeclination(3.14159), '3.1\u00b0 E');
    assert.equal(MagDeclination.formatDeclination(-12.567), '12.6\u00b0 W');
  });
});
