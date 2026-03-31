const BearingGeocoding = (() => {
  /**
   * Parse a coordinate string into { lat, lng }.
   *
   * Supported formats:
   *   - Decimal degrees: "40.7128, -74.006" or "40.7128 -74.006"
   *   - DMS-ish with compass letters: "40.7128N 74.006W" or "40.7128N, 74.006W"
   *
   * Returns null if the string is not a recognized coordinate format or if
   * the parsed values are out of range (lat: -90..90, lng: -180..180).
   *
   * @param {string} text  Input string to parse.
   * @returns {{ lat: number, lng: number } | null}
   */
  function parseCoordinateString(text) {
    const trimmed = text.trim();

    // Decimal degrees: "lat, lng" or "lat lng" (with optional spaces around separator)
    const match = trimmed.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // DMS-ish with compass direction letters: "40.7128N 74.006W" or "40.7128N, 74.006W"
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

  return { parseCoordinateString };
})();
