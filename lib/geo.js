const BearingGeo = (() => {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;

  /**
   * Initial bearing (azimuth) from point A to point B in degrees [0, 360).
   */
  function bearing(lat1, lng1, lat2, lng2) {
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaLambda = toRad(lng2 - lng1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const theta = Math.atan2(y, x);
    return (toDeg(theta) + 360) % 360;
  }

  /**
   * Haversine distance in meters.
   */
  function distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lng2 - lng1);

    const a = Math.sin(deltaPhi / 2) ** 2 +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Bearing degrees to 16-point cardinal direction.
   */
  function cardinalDirection(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  /**
   * Format distance for display.
   */
  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    if (meters < 100000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters / 1000)} km`;
  }

  return { bearing, distance, cardinalDirection, formatDistance };
})();
