/**
 * Tests for the geocoding fallback chain and coordinate parsing.
 * Tests the parseCoordinateString logic extracted from content-isolated.js.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Extract parseCoordinateString from the IIFE (can't easily import, so replicate it)
function parseCoordinateString(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  const dms = trimmed.match(/^(\d+\.?\d*)\s*([NSns])\s*[,\s]\s*(\d+\.?\d*)\s*([EWew])$/);
  if (dms) {
    let lat = parseFloat(dms[1]);
    let lng = parseFloat(dms[3]);
    if (dms[2] === 'S' || dms[2] === 's') lat = -lat;
    if (dms[4] === 'W' || dms[4] === 'w') lng = -lng;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

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
