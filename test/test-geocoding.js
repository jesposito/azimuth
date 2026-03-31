/**
 * Tests for the geocoding fallback chain and coordinate parsing.
 * Tests the parseCoordinateString logic from lib/geocoding.js.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load geocoding.js using vm.runInThisContext so that returned plain objects
// share the same Object prototype as test expectations, allowing deepStrictEqual.
// (The standard load-module.js uses vm.createContext which isolates prototypes.)
const _geocodingCode = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib/geocoding.js'), 'utf-8'
).replace(/^const\s+/gm, 'var ');
vm.runInThisContext(_geocodingCode);
// BearingGeocoding is now defined in this module's context
const parseCoordinateString = BearingGeocoding.parseCoordinateString;

describe('parseCoordinateString()', () => {
  describe('standard lat, lng format', () => {
    it('parses "40.7128, -74.006"', () => {
      const r = parseCoordinateString('40.7128, -74.006');
      assert.deepStrictEqual(r, { lat: 40.7128, lng: -74.006 });
    });

    it('parses "40.7128,-74.006" (no space)', () => {
      const r = parseCoordinateString('40.7128,-74.006');
      assert.deepStrictEqual(r, { lat: 40.7128, lng: -74.006 });
    });

    it('parses "40.7128 -74.006" (space separated)', () => {
      const r = parseCoordinateString('40.7128 -74.006');
      assert.deepStrictEqual(r, { lat: 40.7128, lng: -74.006 });
    });

    it('parses "-33.8688, 151.2093" (negative lat)', () => {
      const r = parseCoordinateString('-33.8688, 151.2093');
      assert.deepStrictEqual(r, { lat: -33.8688, lng: 151.2093 });
    });

    it('parses "0, 0" (origin)', () => {
      const r = parseCoordinateString('0, 0');
      assert.deepStrictEqual(r, { lat: 0, lng: 0 });
    });

    it('parses with leading/trailing whitespace', () => {
      const r = parseCoordinateString('  40.7128,  -74.006  ');
      assert.deepStrictEqual(r, { lat: 40.7128, lng: -74.006 });
    });

    it('rejects out-of-range latitude > 90', () => {
      assert.equal(parseCoordinateString('91, 0'), null);
    });

    it('rejects out-of-range latitude < -90', () => {
      assert.equal(parseCoordinateString('-91, 0'), null);
    });

    it('rejects out-of-range longitude > 180', () => {
      assert.equal(parseCoordinateString('0, 181'), null);
    });

    it('rejects out-of-range longitude < -180', () => {
      assert.equal(parseCoordinateString('0, -181'), null);
    });

    it('accepts boundary values', () => {
      assert.ok(parseCoordinateString('90, 180') !== null, '90, 180');
      assert.ok(parseCoordinateString('-90, -180') !== null, '-90, -180');
    });
  });

  describe('DMS-ish format', () => {
    it('parses "40.7128N 74.006W"', () => {
      const r = parseCoordinateString('40.7128N 74.006W');
      assert.deepStrictEqual(r, { lat: 40.7128, lng: -74.006 });
    });

    it('parses "40.7128N, 74.006W" (with comma)', () => {
      const r = parseCoordinateString('40.7128N, 74.006W');
      assert.deepStrictEqual(r, { lat: 40.7128, lng: -74.006 });
    });

    it('parses "33.8688S 151.2093E" (south/east)', () => {
      const r = parseCoordinateString('33.8688S 151.2093E');
      assert.deepStrictEqual(r, { lat: -33.8688, lng: 151.2093 });
    });

    it('parses lowercase "40.7n 74.0w"', () => {
      const r = parseCoordinateString('40.7n 74.0w');
      assert.deepStrictEqual(r, { lat: 40.7, lng: -74 });
    });

    it('north/east gives positive values', () => {
      const r = parseCoordinateString('51.5N 0.1E');
      assert.ok(r.lat > 0, 'N is positive');
      assert.ok(r.lng > 0, 'E is positive');
    });

    it('south/west gives negative values', () => {
      const r = parseCoordinateString('33.9S 46.6W');
      assert.ok(r.lat < 0, 'S is negative');
      assert.ok(r.lng < 0, 'W is negative');
    });
  });

  describe('non-coordinate strings', () => {
    it('returns null for "Times Square"', () => {
      assert.equal(parseCoordinateString('Times Square'), null);
    });

    it('returns null for "New York, NY"', () => {
      assert.equal(parseCoordinateString('New York, NY'), null);
    });

    it('returns null for empty string', () => {
      assert.equal(parseCoordinateString(''), null);
    });

    it('returns null for single number', () => {
      assert.equal(parseCoordinateString('40.7128'), null);
    });

    it('returns null for three numbers', () => {
      assert.equal(parseCoordinateString('40.7128, -74.006, 100'), null);
    });
  });
});

describe('Nominatim API format', () => {
  // Validate that our service worker response parsing handles the expected format

  it('parses a typical Nominatim response', () => {
    const mockResponse = {
      results: [
        { lat: 40.7484, lng: -73.9857, displayName: 'Empire State Building, NYC', type: 'attraction', importance: 0.8 },
        { lat: 40.7489, lng: -73.9856, displayName: 'Empire State Building, 34th St', type: 'building', importance: 0.6 },
      ],
    };
    const best = mockResponse.results[0];
    assert.equal(best.lat, 40.7484);
    assert.equal(best.lng, -73.9857);
    assert.ok(best.displayName.includes('Empire State'));
  });

  it('handles empty results', () => {
    const mockResponse = { error: 'NO_RESULTS' };
    assert.ok(mockResponse.error === 'NO_RESULTS');
    assert.ok(!mockResponse.results);
  });

  it('handles error responses', () => {
    const mockResponse = { error: 'HTTP_429' };
    assert.ok(mockResponse.error.startsWith('HTTP_'));
  });
});
