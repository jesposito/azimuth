const MagDeclination = (() => {
  // WMM2020 epoch 2020.0 spherical harmonic coefficients (nT)
  // Full model: orders 1-12, 168 main-field coefficients.
  // Source: World Magnetic Model 2020 (NOAA/NCEI), WMM.COF file.
  //
  // G[n][m] = g(n,m), H[n][m] = h(n,m) (main field, nT)
  // Gdot[n][m] = secular variation for g (nT/yr), Hdot[n][m] for h
  // h(n,0) = 0 by convention.
  //
  // Secular variation applied: g_eff = g + gdot * (year - 2020.0)

  /* eslint-disable no-multi-spaces */
  const G = [
    null,                                                                                                                                               // n=0 unused
    [-29404.5, -1450.7,     0,      0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=1
    [ -2500.0,  2982.0,  1676.8,    0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=2
    [  1363.9, -2381.0,  1236.2,  525.7,    0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=3
    [   903.1,   809.4,    86.2, -309.4,   47.9,    0,      0,      0,      0,      0,      0,      0,      0],  // n=4
    [  -234.4,   363.1,   187.8, -140.7, -151.2,   13.7,    0,      0,      0,      0,      0,      0,      0],  // n=5
    [    65.9,    65.6,    73.0, -121.5,  -36.2,   13.5,  -64.7,    0,      0,      0,      0,      0,      0],  // n=6
    [    80.6,   -76.8,    -8.3,   56.5,   15.8,    6.4,   -7.2,    9.8,    0,      0,      0,      0,      0],  // n=7
    [    23.6,     9.8,   -17.5,   -0.4,  -21.1,   15.3,   13.7,  -16.5,   -0.3,    0,      0,      0,      0],  // n=8
    [     5.0,     8.2,     2.9,   -1.4,   -1.1,  -13.3,    1.1,    8.9,   -9.3,  -11.9,    0,      0,      0],  // n=9
    [    -1.9,    -6.2,    -0.1,    1.7,   -0.9,    0.6,   -0.9,    1.9,    1.4,   -2.4,   -3.9,    0,      0],  // n=10
    [     3.0,    -1.4,    -2.5,    2.4,   -0.9,    0.3,   -0.7,   -0.1,    1.4,   -0.6,    0.2,    3.1,    0],  // n=11
    [    -2.0,    -0.1,     0.5,    1.3,   -1.2,    0.7,    0.3,    0.5,   -0.2,   -0.5,    0.1,   -1.1,   -0.3], // n=12
  ];

  const H = [
    null,
    [0,  4652.9,     0,      0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=1
    [0, -2991.6,  -734.8,    0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=2
    [0,   -82.2,   241.8, -542.9,    0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=3
    [0,   282.0,  -158.4,  199.8, -350.1,    0,      0,      0,      0,      0,      0,      0,      0],  // n=4
    [0,    47.7,   208.4, -121.3,   32.2,   99.1,    0,      0,      0,      0,      0,      0,      0],  // n=5
    [0,   -19.1,    25.0,   52.7,  -64.4,    9.0,   68.1,    0,      0,      0,      0,      0,      0],  // n=6
    [0,   -51.4,   -16.8,    2.3,   23.5,   -2.2,  -27.2,   -1.9,    0,      0,      0,      0,      0],  // n=7
    [0,     8.4,   -15.3,   12.8,  -11.8,   14.9,    3.6,   -6.9,    2.8,    0,      0,      0,      0],  // n=8
    [0,   -23.3,    11.1,    9.8,   -5.1,   -6.2,    7.8,    0.4,   -1.5,    9.7,    0,      0,      0],  // n=9
    [0,     3.4,    -0.2,    3.5,    4.8,   -8.6,   -0.1,   -4.2,   -3.4,   -0.1,   -8.8,    0,      0],  // n=10
    [0,    -0.0,     2.6,   -0.5,   -0.4,    0.6,   -0.2,   -1.7,   -1.6,   -3.0,   -2.0,   -2.6,    0],  // n=11
    [0,    -1.2,     0.5,    1.3,   -1.8,    0.1,    0.7,   -0.1,    0.6,    0.2,   -0.9,   -0.0,    0.5], // n=12
  ];

  const Gdot = [
    null,
    [ 6.7,   7.7,   0,      0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=1
    [-11.5,  -7.1,  -2.2,    0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=2
    [  2.8,  -6.2,   3.4,  -12.2,    0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=3
    [ -1.1,  -1.6,  -6.0,    5.4,   -5.5,    0,      0,      0,      0,      0,      0,      0,      0],  // n=4
    [ -0.3,   0.6,  -0.7,    0.1,    1.2,    1.0,    0,      0,      0,      0,      0,      0,      0],  // n=5
    [ -0.6,  -0.4,   0.5,    1.4,   -1.4,   -0.0,    0.8,    0,      0,      0,      0,      0,      0],  // n=6
    [ -0.1,  -0.3,  -0.1,    0.7,    0.2,   -0.5,   -0.8,    1.0,    0,      0,      0,      0,      0],  // n=7
    [ -0.1,   0.1,  -0.1,    0.5,   -0.1,    0.4,    0.5,    0.0,    0.4,    0,      0,      0,      0],  // n=8
    [ -0.1,  -0.2,  -0.0,    0.4,   -0.3,   -0.0,    0.3,   -0.0,   -0.0,   -0.4,    0,      0,      0],  // n=9
    [  0.0,  -0.0,  -0.0,    0.2,   -0.1,   -0.2,   -0.0,   -0.1,   -0.2,   -0.1,   -0.0,    0,      0],  // n=10
    [ -0.0,  -0.1,  -0.0,    0.0,   -0.0,   -0.1,    0.0,   -0.0,   -0.1,   -0.1,   -0.1,   -0.1,    0],  // n=11
    [  0.0,  -0.0,  -0.0,    0.0,   -0.0,   -0.0,    0.0,   -0.0,    0.0,   -0.0,   -0.0,   -0.0,   -0.1], // n=12
  ];

  const Hdot = [
    null,
    [0, -25.1,    0,      0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=1
    [0, -30.2,  -23.9,    0,      0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=2
    [0,   5.7,   -1.0,    1.1,    0,      0,      0,      0,      0,      0,      0,      0,      0],  // n=3
    [0,   0.2,    6.9,    3.7,   -5.6,    0,      0,      0,      0,      0,      0,      0,      0],  // n=4
    [0,   0.1,    2.5,   -0.9,    3.0,    0.5,    0,      0,      0,      0,      0,      0,      0],  // n=5
    [0,   0.1,   -1.8,   -1.4,    0.9,    0.1,    1.0,    0,      0,      0,      0,      0,      0],  // n=6
    [0,   0.5,    0.6,   -0.7,   -0.2,   -1.2,    0.2,    0.3,    0,      0,      0,      0,      0],  // n=7
    [0,  -0.3,    0.7,   -0.2,    0.5,   -0.3,   -0.5,    0.4,    0.1,    0,      0,      0,      0],  // n=8
    [0,  -0.3,    0.2,   -0.4,    0.4,    0.1,   -0.0,   -0.2,    0.5,    0.2,    0,      0,      0],  // n=9
    [0,  -0.0,    0.1,   -0.3,    0.1,   -0.2,    0.1,   -0.0,   -0.1,    0.2,   -0.0,    0,      0],  // n=10
    [0,  -0.0,    0.1,    0.0,    0.2,   -0.0,    0.0,    0.1,   -0.0,   -0.1,    0.0,   -0.0,    0],  // n=11
    [0,  -0.0,    0.0,   -0.1,    0.1,   -0.0,    0.0,   -0.0,    0.1,   -0.0,   -0.0,    0.0,   -0.1], // n=12
  ];
  /* eslint-enable no-multi-spaces */

  // WMM reference sphere radius (km)
  const WMM_A = 6371.2;

  // WMM2020 epoch
  const WMM_EPOCH = 2020.0;

  /**
   * Convert a JS Date to decimal year (e.g. 2025.5).
   */
  function dateToDecimalYear(date) {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear   = new Date(year + 1, 0, 1).getTime();
    return year + (date.getTime() - startOfYear) / (endOfYear - startOfYear);
  }

  /**
   * Compute Schmidt semi-normalized associated Legendre polynomials P[n][m]
   * and their derivatives dP[n][m] w.r.t. colatitude theta, for n = 0..12.
   *
   * Recurrence relations:
   *   Seed:      P[0][0] = 1,  P[1][1] = sinTheta  (base case)
   *   Diagonal:  P[n][n] = sinTheta * sqrt((2n-1)/(2n)) * P[n-1][n-1]  (n >= 2)
   *   General:   P[n][m] = K1 * cosTheta * P[n-1][m] - K2 * P[n-2][m]  (m < n)
   *     where K1 = (2n-1) / sqrt(n^2 - m^2)
   *           K2 = sqrt((n-1)^2 - m^2) / sqrt(n^2 - m^2)
   *     (K2 term is absent when n-2 < m)
   *
   * @param {number} cosTheta  cos(colatitude)
   * @param {number} sinTheta  sin(colatitude)  (caller guards against 0)
   * @returns {{ P: number[][], dP: number[][] }}
   */
  function legendreTable(cosTheta, sinTheta) {
    const N = 13; // indices 0..12
    const P  = [];
    const dP = [];
    for (let i = 0; i < N; i++) {
      P.push(new Array(N).fill(0));
      dP.push(new Array(N).fill(0));
    }

    // Seed values
    P[0][0]  = 1.0;
    dP[0][0] = 0.0;

    // Base case for diagonal: P[1][1] = sinTheta
    // (using the general diagonal formula for n=1 would give sqrt(1/2)*P[0][0], which is wrong)
    P[1][1]  = sinTheta;
    dP[1][1] = cosTheta;

    for (let n = 1; n <= 12; n++) {
      // Diagonal term: P[n][n] (skip n=1, already seeded above)
      if (n >= 2) {
        const K = Math.sqrt((2.0 * n - 1.0) / (2.0 * n));
        P[n][n]  = sinTheta * K * P[n-1][n-1];
        dP[n][n] = cosTheta * K * P[n-1][n-1] + sinTheta * K * dP[n-1][n-1];
      }

      // Off-diagonal terms: P[n][m] for m = 0..n-1
      for (let m = 0; m < n; m++) {
        const denom = Math.sqrt(n * n - m * m);
        const K1 = (2.0 * n - 1.0) / denom;

        if (n - 2 >= m) {
          // General 3-term recurrence
          const K2 = Math.sqrt((n - 1.0) * (n - 1.0) - m * m) / denom;
          P[n][m]  = K1 * cosTheta * P[n-1][m] - K2 * P[n-2][m];
          dP[n][m] = K1 * (-sinTheta * P[n-1][m] + cosTheta * dP[n-1][m]) - K2 * dP[n-2][m];
        } else {
          // 2-term: n-2 < m so P[n-2][m] is zero
          P[n][m]  = K1 * cosTheta * P[n-1][m];
          dP[n][m] = K1 * (-sinTheta * P[n-1][m] + cosTheta * dP[n-1][m]);
        }
      }
    }

    return { P, dP };
  }

  /**
   * Calculate magnetic declination using the full WMM2020 model (spherical
   * harmonic orders 1-12, 168 main-field coefficients). Secular variation is
   * applied: g_eff = g + gdot * (year - 2020.0). Accuracy is typically within
   * 1 degree for most locations between +-60 latitude through the WMM2020 epoch
   * period (2020-2025).
   *
   * @param {number} lat           Geodetic latitude in degrees (-90 to 90)
   * @param {number} lng           Longitude in degrees (-180 to 180)
   * @param {number} [altitudeKm]  Altitude above WGS84 ellipsoid in km (default 0)
   * @param {number} [dateDecimal] Decimal year (e.g. 2025.5); defaults to current date.
   * @returns {number} Magnetic declination in degrees (positive = east, negative = west)
   */
  function getDeclination(lat, lng, altitudeKm, dateDecimal) {
    if (altitudeKm  === undefined || altitudeKm  === null) altitudeKm  = 0;
    if (dateDecimal === undefined || dateDecimal === null) {
      dateDecimal = dateToDecimalYear(new Date());
    }

    const dt = dateDecimal - WMM_EPOCH;
    const lngRad = lng * Math.PI / 180;

    // Colatitude theta (from north pole); cosTheta = sin(lat), sinTheta = cos(lat)
    const theta    = (90 - lat) * Math.PI / 180;
    const cosTheta = Math.cos(theta);             // = sin(lat)
    const sinTheta = Math.max(Math.sin(theta), 1e-10); // = cos(lat); guard pole singularity

    const r = WMM_A + altitudeKm;
    const a = WMM_A;

    const { P, dP } = legendreTable(cosTheta, sinTheta);

    // Accumulate northward (X) and eastward (Y) field components.
    //
    // From the magnetic potential:
    //   V = a * sum_n sum_m (a/r)^(n+1) * [g*cos(m*lng) + h*sin(m*lng)] * P[n][m]
    //
    // X (northward) = -dV/dtheta / r
    //   = sum_n (a/r)^(n+2) * sum_m [g*cos(m*lng) + h*sin(m*lng)] * dP[n][m]
    //
    // Y (eastward) = -(1/(r*sinTheta)) * dV/dlng
    //   = (1/sinTheta) * sum_n (a/r)^(n+2) * sum_m m * [g*sin(m*lng) - h*cos(m*lng)] * P[n][m]

    let X = 0;
    let Y = 0;

    for (let n = 1; n <= 12; n++) {
      const ratioN2 = Math.pow(a / r, n + 2);

      for (let m = 0; m <= n; m++) {
        // Apply secular variation
        const g = G[n][m] + Gdot[n][m] * dt;
        const h = H[n][m] + Hdot[n][m] * dt;

        const cosM = Math.cos(m * lngRad);
        const sinM = Math.sin(m * lngRad);

        X += ratioN2 * (g * cosM + h * sinM) * dP[n][m];

        if (m > 0) {
          Y += ratioN2 * m * (g * sinM - h * cosM) * P[n][m] / sinTheta;
        }
      }
    }

    return Math.atan2(Y, X) * 180 / Math.PI;
  }

  /**
   * Format declination as a human-readable string with direction.
   * Examples: "3.2 E", "12.1 W"  (Unicode degree symbol included)
   *
   * @param {number} deg  Declination in degrees
   * @returns {string}
   */
  function formatDeclination(deg) {
    const abs = Math.abs(deg);
    const dir = deg >= 0 ? 'E' : 'W';
    return abs.toFixed(1) + '\u00b0 ' + dir;
  }

  return { getDeclination, formatDeclination };
})();
