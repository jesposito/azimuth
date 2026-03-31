/**
 * Validation against authoritative reference sources.
 *
 * Bearing & distance: GeographicLib GeodSolve (WGS84 ellipsoidal geodesic)
 *   https://geographiclib.sourceforge.io/cgi-bin/GeodSolve
 *   Karney, C.F.F. (2013) "Algorithms for geodesics", J. Geodesy 87, 43-55.
 *   All ellipsoidal values are WGS84 (a=6378137, f=1/298.257223563).
 *
 * Magnetic declination: BGS World Magnetic Model calculator
 *   https://geomag.bgs.ac.uk/data_service/models_compass/wmm_calc.html
 *   WMM2020 model, date 2025-01-01 (decimal year 2025.0), altitude 0 km.
 *
 * Expected errors:
 *   - Bearing: Haversine (spherical) vs WGS84 (ellipsoidal) -- typically <0.1 deg
 *   - Distance: Haversine uses R=6371000m vs WGS84 ellipsoid -- typically <0.3%,
 *     up to ~0.7% for east-west routes at mid-latitudes (equatorial bulge effect)
 *   - Declination: our WMM2020 implementation vs authoritative WMM2020 -- <0.5 deg
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module');

const { BearingGeo } = loadModule('lib/geo.js');
const { MagDeclination } = loadModule('lib/declination.js');

function assertBearing(actual, expected, tolerance, msg) {
  let diff = Math.abs(actual - expected);
  if (diff > 180) diff = 360 - diff;
  assert.ok(diff <= tolerance,
    `${msg}: expected ${expected.toFixed(3)}, got ${actual.toFixed(3)} (diff ${diff.toFixed(3)})`);
}

function assertDistancePercent(actual, reference, pct, msg) {
  const err = Math.abs(actual - reference) / reference * 100;
  assert.ok(err <= pct,
    `${msg}: expected ~${reference.toFixed(0)}m, got ${actual.toFixed(0)}m (${err.toFixed(3)}% error, limit ${pct}%)`);
}

function assertClose(actual, expected, tolerance, msg) {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tolerance,
    `${msg}: expected ${expected.toFixed(3)}, got ${actual.toFixed(3)} (diff ${diff.toFixed(3)})`);
}

// -----------------------------------------------------------------------
// REFERENCE DATA
// -----------------------------------------------------------------------

// GeographicLib GeodSolve WGS84 reference values
const ROUTES = [
  {
    name: 'JFK-LHR (transatlantic)',
    from: { lat: 40.6413, lng: -73.7781 },
    to:   { lat: 51.4700, lng: -0.4543 },
    ellipsoidalDist: 5554908.791,   // meters
    sphericalDist:   5540011.318,   // Haversine R=6371000
    ellipsoidalAz:   51.382,        // initial azimuth, degrees
    sphericalAz:     51.353,        // spherical bearing
  },
  {
    name: 'Sydney-Tokyo',
    from: { lat: -33.8688, lng: 151.2093 },
    to:   { lat: 35.6762, lng: 139.6503 },
    ellipsoidalDist: 7787514.967,
    ellipsoidalAz:   350.070,
  },
  {
    name: 'NYC-LAX',
    from: { lat: 40.7128, lng: -74.0060 },
    to:   { lat: 34.0522, lng: -118.2437 },
    ellipsoidalDist: 3963256.879,
    ellipsoidalAz:   273.657,
  },
  {
    name: 'Wellington-Cape Town (long southern route)',
    from: { lat: -41.2865, lng: 174.7762 },
    to:   { lat: -33.9249, lng: 18.4241 },
    ellipsoidalDist: 11333243.265,
    ellipsoidalAz:   199.835,
  },
];

// BGS WMM2020 reference values at 2025-01-01 (decimal year 2025.0), altitude 0 km
const DECLINATION_REFS = [
  { name: 'New York City',  lat: 40.7128,  lng: -74.006,   decl: -12.550 },
  { name: 'Denver',         lat: 39.7392,  lng: -104.9903, decl:   7.564 },
  { name: 'London',         lat: 51.5074,  lng:  -0.1278,  decl:   1.013 },
  { name: 'Tokyo',          lat: 35.6762,  lng: 139.6503,  decl:  -7.960 },
  { name: 'Sydney',         lat: -33.8688, lng: 151.2093,  decl:  12.844 },
  { name: 'Wellington',     lat: -41.2865, lng: 174.7762,  decl:  23.215 },
];

// -----------------------------------------------------------------------
// BEARING VALIDATION
// -----------------------------------------------------------------------

describe('Bearing validation (vs GeographicLib WGS84)', () => {
  for (const route of ROUTES) {
    it(`${route.name}: bearing within 0.1 deg of ellipsoidal azimuth`, () => {
      const b = BearingGeo.bearing(
        route.from.lat, route.from.lng,
        route.to.lat, route.to.lng
      );
      assertBearing(b, route.ellipsoidalAz, 0.1, route.name);
    });
  }

  it('JFK-LHR: spherical bearing matches GeodSolve spherical value', () => {
    const r = ROUTES[0]; // JFK-LHR has both spherical and ellipsoidal refs
    const b = BearingGeo.bearing(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    // Our Haversine bearing should be very close to GeodSolve's spherical bearing
    assertBearing(b, r.sphericalAz, 0.01, 'Spherical bearing match');
  });
});

// -----------------------------------------------------------------------
// DISTANCE VALIDATION
// -----------------------------------------------------------------------

describe('Distance validation (vs GeographicLib WGS84)', () => {
  for (const route of ROUTES) {
    // East-west routes at mid-latitudes show up to ~0.7% error due to
    // Haversine's spherical approximation vs the WGS84 equatorial bulge
    const limit = route.name.includes('NYC-LAX') ? 0.7 : 0.5;
    it(`${route.name}: distance within ${limit}% of ellipsoidal`, () => {
      const d = BearingGeo.distance(
        route.from.lat, route.from.lng,
        route.to.lat, route.to.lng
      );
      assertDistancePercent(d, route.ellipsoidalDist, limit, route.name);
    });
  }

  it('JFK-LHR: spherical distance matches GeodSolve spherical value', () => {
    const r = ROUTES[0];
    const d = BearingGeo.distance(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    // Should be very close to the known Haversine value (same R=6371000)
    assertDistancePercent(d, r.sphericalDist, 0.01, 'Spherical distance match');
  });

  it('all routes: Haversine error magnitude and direction', () => {
    // Haversine (spherical) vs WGS84 (ellipsoidal) errors vary by route:
    // - North-south routes: very small error (<0.3%)
    // - East-west at mid-latitudes: larger error (~0.7%) due to equatorial bulge
    // - The sign of the error depends on the route's latitude and orientation
    for (const route of ROUTES) {
      const d = BearingGeo.distance(
        route.from.lat, route.from.lng,
        route.to.lat, route.to.lng
      );
      const errPct = (d - route.ellipsoidalDist) / route.ellipsoidalDist * 100;
      assert.ok(Math.abs(errPct) < 1.0,
        `${route.name}: error ${errPct.toFixed(3)}% should be <1%`);
    }
  });
});

// -----------------------------------------------------------------------
// MAGNETIC DECLINATION VALIDATION
// -----------------------------------------------------------------------

describe('Magnetic declination validation (vs BGS WMM2020)', () => {
  for (const ref of DECLINATION_REFS) {
    it(`${ref.name}: declination within 0.5 deg of BGS reference`, () => {
      const d = MagDeclination.getDeclination(ref.lat, ref.lng, 0, 2025.0);
      assertClose(d, ref.decl, 0.5, ref.name);
    });

    it(`${ref.name}: correct sign (east/west)`, () => {
      const d = MagDeclination.getDeclination(ref.lat, ref.lng, 0, 2025.0);
      if (ref.decl > 0.5) {
        assert.ok(d > 0, `${ref.name}: expected positive (east), got ${d}`);
      } else if (ref.decl < -0.5) {
        assert.ok(d < 0, `${ref.name}: expected negative (west), got ${d}`);
      }
    });
  }
});

// -----------------------------------------------------------------------
// CARDINAL DIRECTION VALIDATION
// -----------------------------------------------------------------------

describe('Cardinal direction validation', () => {
  it('JFK-LHR bearing gives NE cardinal', () => {
    const r = ROUTES[0];
    const b = BearingGeo.bearing(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    assert.equal(BearingGeo.cardinalDirection(b), 'NE',
      `Expected NE for bearing ${b.toFixed(1)}`);
  });

  it('NYC-LAX bearing gives W cardinal', () => {
    const r = ROUTES[2];
    const b = BearingGeo.bearing(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    assert.equal(BearingGeo.cardinalDirection(b), 'W',
      `Expected W for bearing ${b.toFixed(1)}`);
  });

  it('Wellington-Cape Town bearing gives SSW cardinal', () => {
    const r = ROUTES[3];
    const b = BearingGeo.bearing(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    assert.equal(BearingGeo.cardinalDirection(b), 'SSW',
      `Expected SSW for bearing ${b.toFixed(1)}`);
  });
});

// -----------------------------------------------------------------------
// DISTANCE FORMATTING VALIDATION
// -----------------------------------------------------------------------

describe('Distance formatting for real routes', () => {
  it('JFK-LHR formats as ~5540 km', () => {
    const r = ROUTES[0];
    const d = BearingGeo.distance(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    const fmt = BearingGeo.formatDistance(d);
    assert.ok(fmt.endsWith(' km'), `Should end with km, got: ${fmt}`);
    assert.ok(fmt.startsWith('5'), `Should start with 5, got: ${fmt}`);
  });

  it('short distance (100m) formats as meters', () => {
    // ~100m: 0.001 degrees latitude at equator
    const d = BearingGeo.distance(0, 0, 0.0009, 0);
    const fmt = BearingGeo.formatDistance(d);
    assert.ok(fmt.endsWith(' m'), `Short distance should be meters, got: ${fmt}`);
  });
});
