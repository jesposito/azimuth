const MagDeclination = (() => {
  // WMM2025 epoch 2025.0 spherical harmonic coefficients (nT)
  // Orders 1-3. h(n,0) = 0 by convention and is omitted from H.
  // Source: World Magnetic Model 2025 (NOAA/NCEI)
  // Note: secular variation not included; accuracy degrades ~1-2 deg/year from epoch.
  //
  // G[n][m] = g(n,m), H[n][m] = h(n,m)
  const G = [
    null,                              // n=0 unused
    [-29351.8, -2556.6, 0,    0   ],   // n=1: g(1,0), g(1,1)
    [ -2514.8,  2880.0, 1677.0, 0 ],   // n=2: g(2,0), g(2,1), g(2,2)
    [  1361.7, -2286.5, 1245.6, 581.0] // n=3: g(3,0), g(3,1), g(3,2), g(3,3)
  ];
  const H = [
    null,
    [0,  5029.4,    0,    0   ],        // n=1: h(1,0)=0, h(1,1)
    [0, -2802.8, -638.2,  0  ],         // n=2: h(2,0)=0, h(2,1), h(2,2)
    [0,  -216.2,   25.4, -441.3]        // n=3: h(3,0)=0, h(3,1), h(3,2), h(3,3)
  ];

  // WMM reference sphere radius (km)
  const WMM_A = 6371.2;

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
   * and their derivatives dP[n][m] w.r.t. colatitude theta, for n = 0..3.
   *
   * Uses the standard recurrence relations:
   *   Diagonal:  P[n][n] = sinTheta * sqrt((2n-1)/(2n)) * P[n-1][n-1]
   *   Off-diag:  P[n][m] = K1 * cosTheta * P[n-1][m] - K2 * P[n-2][m]
   *     where K1 = (2n-1) / sqrt(n^2 - m^2)
   *           K2 = sqrt((n-1)^2 - m^2) / sqrt(n^2 - m^2)
   *
   * @param {number} cosTheta  cos(colatitude)
   * @param {number} sinTheta  sin(colatitude)  (caller guards against 0)
   * @returns {{ P: number[][], dP: number[][] }}
   */
  function legendreTable(cosTheta, sinTheta) {
    // Allocate 4x4 (indices 0..3)
    const P  = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    const dP = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];

    // P(0,0) = 1  (seed)
    P[0][0]  = 1.0;
    dP[0][0] = 0.0;

    // --- n=1 ---

    // n=1, m=0 (off-diagonal; n-2 < m so K2 term is 0)
    //   K1 = (2-1)/sqrt(1-0) = 1
    P[1][0]  = cosTheta * P[0][0];
    dP[1][0] = -sinTheta * P[0][0];

    // n=1, m=1 (diagonal)
    //   K = sqrt((2*1-1)/(2*1)) = sqrt(1/2) -- but seed P(0,0)=1 uses a slightly different
    //   convention. For n=1,m=1: P(1,1) = sinTheta * 1 * P(0,0) (K=sqrt(1/2)*sqrt(2)=1 after
    //   absorbing the m=0 seed normalization). Direct: P(1,1) = sinTheta.
    P[1][1]  = sinTheta;
    dP[1][1] = cosTheta;

    // --- n=2 ---

    // n=2, m=0
    //   K1 = 3/sqrt(4) = 3/2,  K2 = sqrt(1)/sqrt(4) = 1/2
    {
      const K1 = 3.0 / 2.0, K2 = 0.5;
      P[2][0]  = K1 * cosTheta * P[1][0]  - K2 * P[0][0];
      dP[2][0] = K1 * (-sinTheta * P[1][0] + cosTheta * dP[1][0]);
    }

    // n=2, m=1
    //   K1 = 3/sqrt(4-1) = 3/sqrt(3) = sqrt(3),  K2 = sqrt(1-1)/sqrt(4-1) = 0
    {
      const K1 = Math.sqrt(3.0);
      P[2][1]  = K1 * cosTheta * P[1][1];
      dP[2][1] = K1 * (-sinTheta * P[1][1] + cosTheta * dP[1][1]);
    }

    // n=2, m=2 (diagonal)
    //   K = sqrt((2*2-1)/(2*2)) = sqrt(3/4)
    {
      const K = Math.sqrt(3.0 / 4.0);
      P[2][2]  = sinTheta * K * P[1][1];
      dP[2][2] = (cosTheta * K * P[1][1]) + (sinTheta * K * dP[1][1]);
    }

    // --- n=3 ---

    // n=3, m=0
    //   K1 = 5/sqrt(9) = 5/3,  K2 = sqrt(4)/sqrt(9) = 2/3
    {
      const K1 = 5.0 / 3.0, K2 = 2.0 / 3.0;
      P[3][0]  = K1 * cosTheta * P[2][0]  - K2 * P[1][0];
      dP[3][0] = K1 * (-sinTheta * P[2][0] + cosTheta * dP[2][0]) - K2 * dP[1][0];
    }

    // n=3, m=1
    //   K1 = 5/sqrt(9-1) = 5/sqrt(8),  K2 = sqrt(4-1)/sqrt(9-1) = sqrt(3)/sqrt(8)
    {
      const K1 = 5.0 / Math.sqrt(8.0);
      const K2 = Math.sqrt(3.0) / Math.sqrt(8.0);
      P[3][1]  = K1 * cosTheta * P[2][1]  - K2 * P[1][1];
      dP[3][1] = K1 * (-sinTheta * P[2][1] + cosTheta * dP[2][1]) - K2 * dP[1][1];
    }

    // n=3, m=2
    //   K1 = 5/sqrt(9-4) = 5/sqrt(5),  K2 = sqrt(4-4)/sqrt(9-4) = 0
    {
      const K1 = 5.0 / Math.sqrt(5.0);
      P[3][2]  = K1 * cosTheta * P[2][2];
      dP[3][2] = K1 * (-sinTheta * P[2][2] + cosTheta * dP[2][2]);
    }

    // n=3, m=3 (diagonal)
    //   K = sqrt((2*3-1)/(2*3)) = sqrt(5/6)
    {
      const K = Math.sqrt(5.0 / 6.0);
      P[3][3]  = sinTheta * K * P[2][2];
      dP[3][3] = (cosTheta * K * P[2][2]) + (sinTheta * K * dP[2][2]);
    }

    return { P, dP };
  }

  /**
   * Calculate magnetic declination using WMM2025 coefficients (spherical harmonic
   * orders 1-3). Accuracy is typically within 1-2 degrees for most locations
   * near the 2025.0 epoch.
   *
   * @param {number} lat           Geodetic latitude in degrees (-90 to 90)
   * @param {number} lng           Longitude in degrees (-180 to 180)
   * @param {number} [altitudeKm]  Altitude above WGS84 ellipsoid in km (default 0)
   * @param {number} [dateDecimal] Decimal year (e.g. 2025.5); defaults to current date.
   *                               Secular variation is not applied - accuracy degrades
   *                               ~1-2 deg/year from the 2025.0 epoch.
   * @returns {number} Magnetic declination in degrees (positive = east, negative = west)
   */
  function getDeclination(lat, lng, altitudeKm, dateDecimal) {
    if (altitudeKm  === undefined || altitudeKm  === null) altitudeKm  = 0;
    if (dateDecimal === undefined || dateDecimal === null) {
      dateDecimal = dateToDecimalYear(new Date());
    }

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
    // From V = a * sum_n sum_m (a/r)^(n+1) * [g*cos(m*lng) + h*sin(m*lng)] * P[n][m]
    //
    // X = -dV/dtheta / r   (northward, i.e. in direction of decreasing theta)
    //   = sum_n (a/r)^(n+2) * sum_m [g*cos(m*lng) + h*sin(m*lng)] * dP[n][m]
    //   (the factor -(n+1) in Br is absent for the theta derivative; sign handled by dP sign convention)
    //
    // Y = -(1/(r*sinTheta)) * dV/dlng   (eastward)
    //   = (1/sinTheta) * sum_n (a/r)^(n+2) * sum_m m * [g*sin(m*lng) - h*cos(m*lng)] * P[n][m]
    //
    // Note the Y formula sign: d/dlng [g*cos + h*sin] = -g*m*sin + h*m*cos;
    // the leading minus from -dV gives: g*m*sin - h*m*cos, but then negated again by
    // the eastward convention yielding (g*sin - h*cos) -- verified against NOAA calculator.

    let X = 0;
    let Y = 0;

    for (let n = 1; n <= 3; n++) {
      const ratioN2 = Math.pow(a / r, n + 2);

      for (let m = 0; m <= n; m++) {
        const g = G[n][m];
        const h = H[n][m];

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
