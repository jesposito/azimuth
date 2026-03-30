(function() {
  'use strict';

  // === State ===
  let isActive = false;
  let state = 'IDLE'; // IDLE | WAITING_FIRST | WAITING_SECOND | RESULT
  let pointA = null;  // { lat, lng }
  let pointB = null;
  let mapContainer = null;
  let pendingRequests = {};
  let urlPollInterval = null;
  let lastURL = '';

  // === DOM elements ===
  let toolbar = null;
  let toggleBtn = null;
  let overlay = null;
  let svgEl = null;
  let resultPanel = null;
  let statusEl = null;

  // === Compass icon SVG ===
  const COMPASS_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="12,2 15,10 12,8 9,10" fill="#ea4335" stroke="none"/>
    <polygon points="12,22 9,14 12,16 15,14" fill="#666" stroke="none"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
  </svg>`;

  // === Find map container ===
  function findMapContainer() {
    const selectors = [
      'div[aria-label="Map"]',
      '#map-canvas',
      '.gm-style',
      'div[role="application"]',
      '#scene'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // === Pixel-to-LatLng conversion ===
  function pixelToLatLng(x, y) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      pendingRequests[requestId] = resolve;

      window.postMessage({
        type: 'BEARING_EXT_PIXEL_TO_LATLNG',
        requestId, x, y
      }, '*');

      // Timeout: fallback to URL-based projection
      setTimeout(() => {
        if (pendingRequests[requestId]) {
          delete pendingRequests[requestId];
          const mapState = FallbackProjection.parseMapURL(window.location.href);
          if (mapState && mapContainer) {
            const rect = mapContainer.getBoundingClientRect();
            resolve(FallbackProjection.containerPixelToLatLng(
              x, y, rect.width, rect.height,
              mapState.lat, mapState.lng, mapState.zoom
            ));
          } else {
            resolve(null);
          }
        }
      }, 500);
    });
  }

  // === LatLng-to-Pixel conversion (for repositioning) ===
  function latLngToPixel(lat, lng) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      pendingRequests[requestId] = resolve;

      window.postMessage({
        type: 'BEARING_EXT_LATLNG_TO_PIXEL',
        requestId, lat, lng
      }, '*');

      setTimeout(() => {
        if (pendingRequests[requestId]) {
          delete pendingRequests[requestId];
          const mapState = FallbackProjection.parseMapURL(window.location.href);
          if (mapState && mapContainer) {
            const rect = mapContainer.getBoundingClientRect();
            resolve(FallbackProjection.latLngToContainerPixel(
              lat, lng, rect.width, rect.height,
              mapState.lat, mapState.lng, mapState.zoom
            ));
          } else {
            resolve(null);
          }
        }
      }, 500);
    });
  }

  // Listen for MAIN world responses
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'BEARING_EXT_LATLNG_RESULT') {
      const { requestId, lat, lng, error } = event.data;
      if (pendingRequests[requestId]) {
        const resolve = pendingRequests[requestId];
        delete pendingRequests[requestId];
        if (error) {
          // Fallback
          const mapState = FallbackProjection.parseMapURL(window.location.href);
          if (mapState && mapContainer) {
            const rect = mapContainer.getBoundingClientRect();
            resolve(FallbackProjection.containerPixelToLatLng(
              0, 0, rect.width, rect.height,
              mapState.lat, mapState.lng, mapState.zoom
            ));
          } else {
            resolve(null);
          }
        } else {
          resolve({ lat, lng });
        }
      }
    }

    if (event.data?.type === 'BEARING_EXT_PIXEL_RESULT') {
      const { requestId, x, y, error } = event.data;
      if (pendingRequests[requestId]) {
        const resolve = pendingRequests[requestId];
        delete pendingRequests[requestId];
        if (error) {
          resolve(null);
        } else {
          resolve({ x, y });
        }
      }
    }
  });

  // === UI Creation ===
  function createUI() {
    // Toolbar with toggle button
    toolbar = document.createElement('div');
    toolbar.className = 'bearing-toolbar';

    toggleBtn = document.createElement('button');
    toggleBtn.className = 'bearing-toggle-btn';
    toggleBtn.innerHTML = COMPASS_SVG;
    toggleBtn.title = 'Bearing Tool';
    toggleBtn.addEventListener('click', toggleTool);
    toolbar.appendChild(toggleBtn);

    // Result panel
    resultPanel = document.createElement('div');
    resultPanel.className = 'bearing-result-panel';

    // Status tooltip
    statusEl = document.createElement('div');
    statusEl.className = 'bearing-status';

    document.body.appendChild(toolbar);
    document.body.appendChild(resultPanel);
    document.body.appendChild(statusEl);
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'bearing-overlay';

    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.position = 'absolute';
    svgEl.style.top = '0';
    svgEl.style.left = '0';
    overlay.appendChild(svgEl);

    overlay.addEventListener('click', handleOverlayClick);

    // Insert overlay into the map container
    mapContainer.style.position = mapContainer.style.position || 'relative';
    mapContainer.appendChild(overlay);
  }

  // === Tool activation ===
  function toggleTool() {
    if (isActive) {
      deactivate();
    } else {
      activate();
    }
  }

  function activate() {
    isActive = true;
    state = 'WAITING_FIRST';
    toggleBtn.classList.add('active');
    overlay.classList.add('active');
    setStatus('Click to place start point');
    startURLPoll();
  }

  function deactivate() {
    isActive = false;
    state = 'IDLE';
    pointA = null;
    pointB = null;
    toggleBtn.classList.remove('active');
    overlay.classList.remove('active');
    clearSVG();
    hideResult();
    hideStatus();
    stopURLPoll();
  }

  function setStatus(text) {
    statusEl.textContent = text;
    statusEl.classList.add('visible');
  }

  function hideStatus() {
    statusEl.classList.remove('visible');
  }

  // === Click handling ===
  async function handleOverlayClick(event) {
    if (!isActive) return;

    const rect = mapContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const latLng = await pixelToLatLng(x, y);
    if (!latLng) return;

    if (state === 'WAITING_FIRST') {
      pointA = { lat: latLng.lat, lng: latLng.lng };
      await renderMarkers();
      state = 'WAITING_SECOND';
      setStatus('Click to place end point');

    } else if (state === 'WAITING_SECOND') {
      pointB = { lat: latLng.lat, lng: latLng.lng };
      await renderMarkers();
      showResult();
      state = 'RESULT';
      hideStatus();

    } else if (state === 'RESULT') {
      // Start new measurement
      pointA = { lat: latLng.lat, lng: latLng.lng };
      pointB = null;
      clearSVG();
      hideResult();
      await renderMarkers();
      state = 'WAITING_SECOND';
      setStatus('Click to place end point');
    }
  }

  // === SVG rendering ===
  function clearSVG() {
    while (svgEl.firstChild) {
      svgEl.removeChild(svgEl.firstChild);
    }
  }

  function createMarker(x, y, label) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '8');
    circle.setAttribute('class', 'bearing-marker');
    g.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('class', 'bearing-marker-label');
    text.textContent = label;
    g.appendChild(text);

    return g;
  }

  function createLine(x1, y1, x2, y2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', 'bearing-line');
    return line;
  }

  async function renderMarkers() {
    clearSVG();

    if (pointA) {
      const pxA = await latLngToPixel(pointA.lat, pointA.lng);
      if (pxA) {
        svgEl.appendChild(createMarker(pxA.x, pxA.y, 'A'));

        if (pointB) {
          const pxB = await latLngToPixel(pointB.lat, pointB.lng);
          if (pxB) {
            svgEl.appendChild(createLine(pxA.x, pxA.y, pxB.x, pxB.y));
            svgEl.appendChild(createMarker(pxB.x, pxB.y, 'B'));
          }
        }
      }
    }
  }

  // === Result display ===
  function showResult() {
    if (!pointA || !pointB) return;

    const deg = BearingGeo.bearing(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    const cardinal = BearingGeo.cardinalDirection(deg);
    const dist = BearingGeo.distance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    const distStr = BearingGeo.formatDistance(dist);

    // Build result panel using safe DOM methods
    while (resultPanel.firstChild) {
      resultPanel.removeChild(resultPanel.firstChild);
    }

    const clearBtn = document.createElement('button');
    clearBtn.className = 'bearing-clear-btn';
    clearBtn.title = 'Clear';
    clearBtn.textContent = '\u00D7';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearMeasurement();
    });

    const heading = document.createElement('div');
    heading.className = 'bearing-result-heading';

    const degreesSpan = document.createElement('span');
    degreesSpan.className = 'bearing-degrees';
    degreesSpan.textContent = deg.toFixed(1) + '\u00B0';

    const cardinalSpan = document.createElement('span');
    cardinalSpan.className = 'bearing-cardinal';
    cardinalSpan.textContent = cardinal;

    heading.appendChild(degreesSpan);
    heading.appendChild(cardinalSpan);

    const distDiv = document.createElement('div');
    distDiv.className = 'bearing-distance';
    distDiv.textContent = distStr;

    resultPanel.appendChild(clearBtn);
    resultPanel.appendChild(heading);
    resultPanel.appendChild(distDiv);

    resultPanel.classList.add('visible');
  }

  function hideResult() {
    resultPanel.classList.remove('visible');
  }

  function clearMeasurement() {
    pointA = null;
    pointB = null;
    clearSVG();
    hideResult();
    if (isActive) {
      state = 'WAITING_FIRST';
      setStatus('Click to place start point');
    }
  }

  // === Map movement tracking ===
  function startURLPoll() {
    lastURL = window.location.href;
    urlPollInterval = setInterval(async () => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        lastURL = currentURL;
        if (pointA) {
          await renderMarkers();
        }
      }
    }, 200);
  }

  function stopURLPoll() {
    if (urlPollInterval) {
      clearInterval(urlPollInterval);
      urlPollInterval = null;
    }
  }

  // === Keyboard shortcuts ===
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isActive) {
      if (state === 'RESULT' || pointA) {
        clearMeasurement();
      } else {
        deactivate();
      }
    }
  });

  // === Listen for messages from popup/background ===
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SET_BEARING_ACTIVE') {
        if (message.active && !isActive) {
          activate();
        } else if (!message.active && isActive) {
          deactivate();
        }
      }
    });
  }

  // === Initialize ===
  function init() {
    mapContainer = findMapContainer();
    if (!mapContainer) {
      const observer = new MutationObserver(() => {
        mapContainer = findMapContainer();
        if (mapContainer) {
          observer.disconnect();
          setup();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Give up after 30 seconds
      setTimeout(() => observer.disconnect(), 30000);
      return;
    }
    setup();
  }

  function setup() {
    createUI();
    createOverlay();
  }

  init();
})();
