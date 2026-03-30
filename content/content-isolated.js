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
  let dragging = null; // 'A' or 'B' while dragging

  // === DOM elements ===
  let toolbar = null;
  let toggleBtn = null;
  let overlay = null;
  let svgEl = null;
  let resultPanel = null;
  let statusEl = null;

  // SVG element refs for efficient updates during drag
  let markerGroupA = null;
  let markerGroupB = null;
  let lineEl = null;
  let previewLineEl = null;
  let arrowEl = null;

  // === Colors ===
  const COLOR_A = '#34a853'; // green - start
  const COLOR_B = '#ea4335'; // red - end
  const COLOR_LINE = '#4285f4'; // blue - line

  // === Build compass icon via DOM ===
  function createCompassIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#666');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    const northTriangle = document.createElementNS(ns, 'polygon');
    northTriangle.setAttribute('points', '12,2 15,10 12,8 9,10');
    northTriangle.setAttribute('fill', '#ea4335');
    northTriangle.setAttribute('stroke', 'none');
    svg.appendChild(northTriangle);

    const southTriangle = document.createElementNS(ns, 'polygon');
    southTriangle.setAttribute('points', '12,22 9,14 12,16 15,14');
    southTriangle.setAttribute('fill', '#666');
    southTriangle.setAttribute('stroke', 'none');
    svg.appendChild(southTriangle);

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '8');
    line.setAttribute('x2', '12');
    line.setAttribute('y2', '16');
    svg.appendChild(line);

    return svg;
  }

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

  // === Coordinate conversion with fixed fallback ===
  function pixelToLatLng(x, y) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      // Store original coords so error handler can use them
      pendingRequests[requestId] = { resolve, x, y, type: 'pixelToLatLng' };

      window.postMessage({
        type: 'BEARING_EXT_PIXEL_TO_LATLNG',
        requestId, x, y
      }, '*');

      setTimeout(() => {
        const pending = pendingRequests[requestId];
        if (pending) {
          delete pendingRequests[requestId];
          resolveFallbackPixelToLatLng(pending.x, pending.y, pending.resolve);
        }
      }, 500);
    });
  }

  function resolveFallbackPixelToLatLng(x, y, resolve) {
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

  function latLngToPixel(lat, lng) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      pendingRequests[requestId] = { resolve, lat, lng, type: 'latLngToPixel' };

      window.postMessage({
        type: 'BEARING_EXT_LATLNG_TO_PIXEL',
        requestId, lat, lng
      }, '*');

      setTimeout(() => {
        const pending = pendingRequests[requestId];
        if (pending) {
          delete pendingRequests[requestId];
          resolveFallbackLatLngToPixel(pending.lat, pending.lng, pending.resolve);
        }
      }, 500);
    });
  }

  function resolveFallbackLatLngToPixel(lat, lng, resolve) {
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

  // Synchronous fallback for drag and preview (no async delay)
  function latLngToPixelSync(lat, lng) {
    const mapState = FallbackProjection.parseMapURL(window.location.href);
    if (mapState && mapContainer) {
      const rect = mapContainer.getBoundingClientRect();
      return FallbackProjection.latLngToContainerPixel(
        lat, lng, rect.width, rect.height,
        mapState.lat, mapState.lng, mapState.zoom
      );
    }
    return null;
  }

  function pixelToLatLngSync(x, y) {
    const mapState = FallbackProjection.parseMapURL(window.location.href);
    if (mapState && mapContainer) {
      const rect = mapContainer.getBoundingClientRect();
      return FallbackProjection.containerPixelToLatLng(
        x, y, rect.width, rect.height,
        mapState.lat, mapState.lng, mapState.zoom
      );
    }
    return null;
  }

  // Listen for MAIN world responses
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'BEARING_EXT_LATLNG_RESULT') {
      const { requestId, lat, lng, error } = event.data;
      const pending = pendingRequests[requestId];
      if (pending) {
        delete pendingRequests[requestId];
        if (error) {
          resolveFallbackPixelToLatLng(pending.x, pending.y, pending.resolve);
        } else {
          pending.resolve({ lat, lng });
        }
      }
    }

    if (event.data?.type === 'BEARING_EXT_PIXEL_RESULT') {
      const { requestId, x, y, error } = event.data;
      const pending = pendingRequests[requestId];
      if (pending) {
        delete pendingRequests[requestId];
        if (error) {
          resolveFallbackLatLngToPixel(pending.lat, pending.lng, pending.resolve);
        } else {
          pending.resolve({ x, y });
        }
      }
    }
  });

  // === UI Creation ===
  function createUI() {
    toolbar = document.createElement('div');
    toolbar.className = 'bearing-toolbar';

    toggleBtn = document.createElement('button');
    toggleBtn.className = 'bearing-toggle-btn';
    toggleBtn.appendChild(createCompassIcon());
    toggleBtn.title = 'Bearing Tool (Azimuth)';
    toggleBtn.setAttribute('aria-label', 'Toggle bearing measurement tool');
    toggleBtn.addEventListener('click', toggleTool);
    toolbar.appendChild(toggleBtn);

    resultPanel = document.createElement('div');
    resultPanel.className = 'bearing-result-panel';
    resultPanel.setAttribute('role', 'status');
    resultPanel.setAttribute('aria-live', 'polite');

    statusEl = document.createElement('div');
    statusEl.className = 'bearing-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

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

    // Arrow marker definition in defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgEl.appendChild(defs);

    overlay.appendChild(svgEl);

    overlay.addEventListener('click', handleOverlayClick);
    overlay.addEventListener('mousemove', handleOverlayMouseMove);
    overlay.addEventListener('mousedown', handleOverlayMouseDown);

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
    dragging = null;
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
    if (!isActive || dragging) return;

    // Don't handle clicks on marker handles (those are for dragging)
    if (event.target.closest('.bearing-marker-handle')) return;

    const rect = mapContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const latLng = await pixelToLatLng(x, y);
    if (!latLng) return;

    if (state === 'WAITING_FIRST') {
      pointA = { lat: latLng.lat, lng: latLng.lng };
      await renderAll();
      state = 'WAITING_SECOND';
      setStatus('Click to place end point');

    } else if (state === 'WAITING_SECOND') {
      pointB = { lat: latLng.lat, lng: latLng.lng };
      await renderAll();
      showResult();
      state = 'RESULT';
      setStatus('Drag markers to adjust - click elsewhere to restart');

    } else if (state === 'RESULT') {
      pointA = { lat: latLng.lat, lng: latLng.lng };
      pointB = null;
      await renderAll();
      hideResult();
      state = 'WAITING_SECOND';
      setStatus('Click to place end point');
    }
  }

  // === Preview line while placing second point + drag handling ===
  function handleOverlayMouseMove(event) {
    if (!isActive) return;

    const rect = mapContainer.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    // Dragging a marker
    if (dragging) {
      const latLng = pixelToLatLngSync(mx, my);
      if (!latLng) return;

      if (dragging === 'A') {
        pointA = { lat: latLng.lat, lng: latLng.lng };
      } else {
        pointB = { lat: latLng.lat, lng: latLng.lng };
      }
      renderAllSync();
      if (pointA && pointB) showResult();
      return;
    }

    // Preview line from A to cursor
    if (state === 'WAITING_SECOND' && pointA) {
      const pxA = latLngToPixelSync(pointA.lat, pointA.lng);
      if (!pxA) return;
      if (!previewLineEl) {
        previewLineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        previewLineEl.setAttribute('class', 'bearing-preview-line');
        svgEl.appendChild(previewLineEl);
      }
      previewLineEl.setAttribute('x1', pxA.x);
      previewLineEl.setAttribute('y1', pxA.y);
      previewLineEl.setAttribute('x2', mx);
      previewLineEl.setAttribute('y2', my);

      // Show live bearing in status
      const cursorLatLng = pixelToLatLngSync(mx, my);
      if (cursorLatLng) {
        const deg = BearingGeo.bearing(pointA.lat, pointA.lng, cursorLatLng.lat, cursorLatLng.lng);
        const cardinal = BearingGeo.cardinalDirection(deg);
        const dist = BearingGeo.distance(pointA.lat, pointA.lng, cursorLatLng.lat, cursorLatLng.lng);
        setStatus(deg.toFixed(1) + '\u00B0 ' + cardinal + '  \u00B7  ' + BearingGeo.formatDistance(dist) + '  \u2014  click to place end point');
      }
    }
  }

  // === Drag start ===
  function handleOverlayMouseDown(event) {
    if (!isActive || state !== 'RESULT') return;
    const handle = event.target.closest('.bearing-marker-handle');
    if (!handle) return;

    event.preventDefault();
    event.stopPropagation();
    dragging = handle.dataset.point; // 'A' or 'B'
    overlay.classList.add('dragging');

    const onMouseUp = () => {
      dragging = null;
      overlay.classList.remove('dragging');
      document.removeEventListener('mouseup', onMouseUp);
      setStatus('Drag markers to adjust - click elsewhere to restart');
    };
    document.addEventListener('mouseup', onMouseUp);
  }

  // === SVG rendering ===
  function clearSVG() {
    // Keep the defs element
    const defs = svgEl.querySelector('defs');
    while (svgEl.firstChild) {
      svgEl.removeChild(svgEl.firstChild);
    }
    if (defs) svgEl.appendChild(defs);
    markerGroupA = null;
    markerGroupB = null;
    lineEl = null;
    previewLineEl = null;
    arrowEl = null;
  }

  function createMarkerGroup(x, y, label, color, draggable) {
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');

    // Pulse ring on creation
    const pulse = document.createElementNS(ns, 'circle');
    pulse.setAttribute('cx', '0');
    pulse.setAttribute('cy', '0');
    pulse.setAttribute('r', '16');
    pulse.setAttribute('fill', 'none');
    pulse.setAttribute('stroke', color);
    pulse.setAttribute('stroke-width', '2');
    pulse.setAttribute('opacity', '0.3');
    pulse.setAttribute('class', 'bearing-pulse');
    g.appendChild(pulse);

    // Main circle
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '2.5');
    circle.setAttribute('class', 'bearing-marker' + (draggable ? ' bearing-marker-handle' : ''));
    if (draggable) {
      circle.dataset.point = label;
    }
    g.appendChild(circle);

    // Label text
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '0.5');
    text.setAttribute('class', 'bearing-marker-label');
    text.textContent = label;
    g.appendChild(text);

    // Drag hint below marker
    if (draggable) {
      const hint = document.createElementNS(ns, 'text');
      hint.setAttribute('x', '0');
      hint.setAttribute('y', '22');
      hint.setAttribute('class', 'bearing-drag-hint');
      hint.textContent = '\u2725'; // four-way arrow
      g.appendChild(hint);
    }

    return g;
  }

  function drawFullLine(pxA, pxB) {
    const ns = 'http://www.w3.org/2000/svg';

    // Main dashed line
    lineEl = document.createElementNS(ns, 'line');
    lineEl.setAttribute('x1', pxA.x);
    lineEl.setAttribute('y1', pxA.y);
    lineEl.setAttribute('x2', pxB.x);
    lineEl.setAttribute('y2', pxB.y);
    lineEl.setAttribute('class', 'bearing-line');
    svgEl.appendChild(lineEl);

    // Direction arrow at midpoint
    const midX = (pxA.x + pxB.x) / 2;
    const midY = (pxA.y + pxB.y) / 2;
    const angle = Math.atan2(pxB.y - pxA.y, pxB.x - pxA.x) * 180 / Math.PI;

    arrowEl = document.createElementNS(ns, 'g');
    arrowEl.setAttribute('transform', 'translate(' + midX + ',' + midY + ') rotate(' + angle + ')');

    const arrowPath = document.createElementNS(ns, 'path');
    arrowPath.setAttribute('d', 'M-8,-6 L8,0 L-8,6 Z');
    arrowPath.setAttribute('fill', COLOR_LINE);
    arrowPath.setAttribute('stroke', '#fff');
    arrowPath.setAttribute('stroke-width', '1.5');
    arrowPath.setAttribute('class', 'bearing-arrow');
    arrowEl.appendChild(arrowPath);

    svgEl.appendChild(arrowEl);
  }

  // Async render (used for initial placement and map moves)
  async function renderAll() {
    clearSVG();
    if (!pointA) return;

    const pxA = await latLngToPixel(pointA.lat, pointA.lng);
    if (!pxA) return;

    if (pointB) {
      const pxB = await latLngToPixel(pointB.lat, pointB.lng);
      if (!pxB) return;
      drawFullLine(pxA, pxB);
      markerGroupA = createMarkerGroup(pxA.x, pxA.y, 'A', COLOR_A, state === 'RESULT');
      svgEl.appendChild(markerGroupA);
      markerGroupB = createMarkerGroup(pxB.x, pxB.y, 'B', COLOR_B, true);
      svgEl.appendChild(markerGroupB);
    } else {
      markerGroupA = createMarkerGroup(pxA.x, pxA.y, 'A', COLOR_A, false);
      svgEl.appendChild(markerGroupA);
    }
  }

  // Sync render (used during drag for responsiveness)
  function renderAllSync() {
    clearSVG();
    if (!pointA) return;

    const pxA = latLngToPixelSync(pointA.lat, pointA.lng);
    if (!pxA) return;

    if (pointB) {
      const pxB = latLngToPixelSync(pointB.lat, pointB.lng);
      if (pxB) {
        drawFullLine(pxA, pxB);
        markerGroupA = createMarkerGroup(pxA.x, pxA.y, 'A', COLOR_A, true);
        svgEl.appendChild(markerGroupA);
        markerGroupB = createMarkerGroup(pxB.x, pxB.y, 'B', COLOR_B, true);
        svgEl.appendChild(markerGroupB);
      }
    } else {
      markerGroupA = createMarkerGroup(pxA.x, pxA.y, 'A', COLOR_A, false);
      svgEl.appendChild(markerGroupA);
    }
  }

  // === Result display ===
  function showResult() {
    if (!pointA || !pointB) return;

    const deg = BearingGeo.bearing(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    const cardinal = BearingGeo.cardinalDirection(deg);
    const dist = BearingGeo.distance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    const distStr = BearingGeo.formatDistance(dist);

    while (resultPanel.firstChild) {
      resultPanel.removeChild(resultPanel.firstChild);
    }

    const clearBtn = document.createElement('button');
    clearBtn.className = 'bearing-clear-btn';
    clearBtn.title = 'Clear measurement';
    clearBtn.setAttribute('aria-label', 'Clear measurement');
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

    const coordsDiv = document.createElement('div');
    coordsDiv.className = 'bearing-coords';
    coordsDiv.textContent = pointA.lat.toFixed(5) + ', ' + pointA.lng.toFixed(5) +
      '  \u2192  ' + pointB.lat.toFixed(5) + ', ' + pointB.lng.toFixed(5);

    resultPanel.appendChild(clearBtn);
    resultPanel.appendChild(heading);
    resultPanel.appendChild(distDiv);
    resultPanel.appendChild(coordsDiv);

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
          await renderAll();
          if (pointA && pointB) showResult();
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
