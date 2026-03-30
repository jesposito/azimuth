(function() {
  'use strict';

  // === State ===
  let isActive = false;
  let state = 'IDLE'; // IDLE | PLACING | RESULT
  let waypoints = []; // array of { lat, lng }
  let mapContainer = null;
  let pendingRequests = {};
  let urlPollInterval = null;
  let lastURL = '';
  let dragging = null; // index (number) of waypoint being dragged, or null

  // === DOM elements ===
  let toolbar = null;
  let toggleBtn = null;
  let overlay = null;
  let svgEl = null;
  let resultPanel = null;
  let statusEl = null;
  let searchPanel = null;
  let searchInputStart = null;
  let searchInputEnd = null;

  // === Colors ===
  const COLOR_START = '#34a853'; // green - start
  const COLOR_END   = '#ea4335'; // red - end
  const COLOR_MID   = '#4285f4'; // blue - intermediate waypoints
  const COLOR_LINE  = '#4285f4'; // blue - line

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

  // === Build search icon (magnifying glass) ===
  function createSearchIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#9aa0a6');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', 'bearing-search-icon');

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '11');
    circle.setAttribute('cy', '11');
    circle.setAttribute('r', '7');
    svg.appendChild(circle);

    const handle = document.createElementNS(ns, 'line');
    handle.setAttribute('x1', '16.5');
    handle.setAttribute('y1', '16.5');
    handle.setAttribute('x2', '22');
    handle.setAttribute('y2', '22');
    svg.appendChild(handle);

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

  // === Coordinate conversion with async + fallback ===
  function pixelToLatLng(x, y) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
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

  // === Geocoding ===
  function geocodeQuery(query) {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      pendingRequests[requestId] = { resolve, type: 'geocode', query };

      window.postMessage({
        type: 'BEARING_EXT_GEOCODE',
        requestId,
        query
      }, '*');

      setTimeout(() => {
        const pending = pendingRequests[requestId];
        if (pending) {
          delete pendingRequests[requestId];
          // Fall back: try to parse as "lat, lng"
          const parsed = parseCoordinateString(pending.query);
          pending.resolve(parsed ? { lat: parsed.lat, lng: parsed.lng } : null);
        }
      }, 3000);
    });
  }

  function parseCoordinateString(text) {
    // Try to parse "lat, lng" format
    const match = text.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
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

    if (event.data?.type === 'BEARING_EXT_GEOCODE_RESULT') {
      const { requestId, lat, lng, formattedAddress, error } = event.data;
      const pending = pendingRequests[requestId];
      if (pending) {
        delete pendingRequests[requestId];
        if (error) {
          // Try coordinate parse fallback
          const parsed = parseCoordinateString(pending.query);
          pending.resolve(parsed ? { lat: parsed.lat, lng: parsed.lng } : null);
        } else {
          pending.resolve({ lat, lng, formattedAddress });
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

    // Search panel (slides in when tool is active)
    searchPanel = document.createElement('div');
    searchPanel.className = 'bearing-search-panel';

    searchInputStart = createSearchField('Start address or place...');
    searchPanel.appendChild(searchInputStart.wrapper);

    const divider = document.createElement('div');
    divider.className = 'bearing-search-divider';
    searchPanel.appendChild(divider);

    searchInputEnd = createSearchField('End address or place...');
    searchPanel.appendChild(searchInputEnd.wrapper);

    // Wire search submit handlers once at creation time
    searchInputStart.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearchSubmit(searchInputStart, 'start');
    });
    searchInputEnd.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearchSubmit(searchInputEnd, 'end');
    });

    resultPanel = document.createElement('div');
    resultPanel.className = 'bearing-result-panel';
    resultPanel.setAttribute('role', 'status');
    resultPanel.setAttribute('aria-live', 'polite');

    statusEl = document.createElement('div');
    statusEl.className = 'bearing-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

    document.body.appendChild(toolbar);
    document.body.appendChild(searchPanel);
    document.body.appendChild(resultPanel);
    document.body.appendChild(statusEl);
  }

  function createSearchField(placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bearing-search-field';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'bearing-search-icon-wrap';
    iconWrap.appendChild(createSearchIcon());
    wrapper.appendChild(iconWrap);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.className = 'bearing-search-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    wrapper.appendChild(input);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'bearing-search-clear';
    clearBtn.title = 'Clear';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.textContent = '\u00D7';
    clearBtn.style.display = 'none';
    wrapper.appendChild(clearBtn);

    // Loading spinner
    const spinner = document.createElement('span');
    spinner.className = 'bearing-search-spinner';
    spinner.style.display = 'none';
    wrapper.appendChild(spinner);

    input.addEventListener('input', () => {
      clearBtn.style.display = input.value ? 'flex' : 'none';
    });

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      input.value = '';
      clearBtn.style.display = 'none';
      input.focus();
    });

    return { wrapper, input, clearBtn, spinner };
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

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgEl.appendChild(defs);

    overlay.appendChild(svgEl);

    overlay.addEventListener('click', handleOverlayClick);
    overlay.addEventListener('dblclick', handleOverlayDblClick);
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
    state = 'PLACING';
    toggleBtn.classList.add('active');
    overlay.classList.add('active');
    searchPanel.classList.add('visible');
    setStatus('Click to place start point');
    startURLPoll();
  }

  function deactivate() {
    isActive = false;
    state = 'IDLE';
    waypoints = [];
    dragging = null;
    toggleBtn.classList.remove('active');
    overlay.classList.remove('active');
    searchPanel.classList.remove('visible');
    clearSVG();
    hideResult();
    hideStatus();
    stopURLPoll();
    // Clear search inputs
    if (searchInputStart) {
      searchInputStart.input.value = '';
      searchInputStart.clearBtn.style.display = 'none';
    }
    if (searchInputEnd) {
      searchInputEnd.input.value = '';
      searchInputEnd.clearBtn.style.display = 'none';
    }
  }

  async function handleSearchSubmit(field, role) {
    const query = field.input.value.trim();
    if (!query) return;

    field.spinner.style.display = 'inline-block';
    field.clearBtn.style.display = 'none';

    const result = await geocodeQuery(query);

    field.spinner.style.display = 'none';
    field.clearBtn.style.display = field.input.value ? 'flex' : 'none';

    if (!result) {
      field.input.classList.add('bearing-search-error');
      setTimeout(() => field.input.classList.remove('bearing-search-error'), 1500);
      return;
    }

    if (role === 'start') {
      if (waypoints.length === 0) {
        waypoints.push({ lat: result.lat, lng: result.lng });
      } else {
        waypoints[0] = { lat: result.lat, lng: result.lng };
      }
    } else {
      if (waypoints.length === 0) {
        // No start yet - place this as the end and wait for start
        waypoints.push({ lat: result.lat, lng: result.lng });
      } else if (waypoints.length === 1) {
        // Start exists - append as end
        waypoints.push({ lat: result.lat, lng: result.lng });
      } else {
        // Multiple waypoints - replace the last one
        waypoints[waypoints.length - 1] = { lat: result.lat, lng: result.lng };
      }
    }

    await renderAll();

    if (waypoints.length >= 2) {
      showResult();
      state = 'RESULT';
      setStatus('Drag markers to adjust \u00B7 click map to add waypoints \u00B7 double-click middle marker to remove');
    } else {
      state = 'PLACING';
      setStatus('Click to place end point');
    }
  }

  function setStatus(text) {
    statusEl.textContent = text;
    statusEl.classList.add('visible');
  }

  function hideStatus() {
    statusEl.classList.remove('visible');
  }

  // === Click handling ===
  // Track last click time to avoid treating first click of a dblclick as a place action
  let lastClickTime = 0;
  let clickPendingTimer = null;

  async function handleOverlayClick(event) {
    if (!isActive || dragging !== null) return;
    if (event.target.closest('.bearing-marker-handle')) return;

    const now = Date.now();
    // Cancel any pending single-click if this is a fast second click (dblclick)
    if (now - lastClickTime < 350 && clickPendingTimer) {
      clearTimeout(clickPendingTimer);
      clickPendingTimer = null;
      lastClickTime = now;
      return;
    }
    lastClickTime = now;

    // Delay to give dblclick a chance to cancel this
    const eventSnapshot = { clientX: event.clientX, clientY: event.clientY };
    clickPendingTimer = setTimeout(async () => {
      clickPendingTimer = null;
      await processClick(eventSnapshot);
    }, 220);
  }

  async function processClick(event) {
    const rect = mapContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const latLng = await pixelToLatLng(x, y);
    if (!latLng) return;

    if (state === 'PLACING') {
      waypoints.push({ lat: latLng.lat, lng: latLng.lng });
      await renderAll();

      if (waypoints.length === 1) {
        setStatus('Click to place end point');
      } else {
        showResult();
        state = 'RESULT';
        setStatus('Drag markers to adjust \u00B7 click map to add waypoints \u00B7 double-click middle marker to remove');
      }

    } else if (state === 'RESULT') {
      // Add a new waypoint at the end
      waypoints.push({ lat: latLng.lat, lng: latLng.lng });
      await renderAll();
      showResult();
      setStatus('Drag markers to adjust \u00B7 click map to add waypoints \u00B7 double-click middle marker to remove');
    }
  }

  // === Double-click to remove intermediate waypoint ===
  function handleOverlayDblClick(event) {
    if (!isActive || state !== 'RESULT') return;
    const handle = event.target.closest('.bearing-marker-handle');
    if (!handle) return;

    const idx = parseInt(handle.dataset.point, 10);
    // Cannot remove first or last waypoint (only intermediates)
    if (isNaN(idx) || idx === 0 || idx === waypoints.length - 1) return;

    // Cancel the pending single click that was fired before this dblclick
    if (clickPendingTimer) {
      clearTimeout(clickPendingTimer);
      clickPendingTimer = null;
    }

    waypoints.splice(idx, 1);
    renderAllSync();
    showResult();
    setStatus('Drag markers to adjust \u00B7 click map to add waypoints \u00B7 double-click middle marker to remove');
  }

  // === Preview line while placing + drag handling ===
  let previewLineEl = null;

  function handleOverlayMouseMove(event) {
    if (!isActive) return;

    const rect = mapContainer.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    // Dragging a marker
    if (dragging !== null) {
      const latLng = pixelToLatLngSync(mx, my);
      if (!latLng) return;
      waypoints[dragging] = { lat: latLng.lat, lng: latLng.lng };
      renderAllSync();
      if (waypoints.length >= 2) showResult();
      return;
    }

    // Preview line from last waypoint to cursor
    if (state === 'PLACING' && waypoints.length >= 1) {
      const last = waypoints[waypoints.length - 1];
      const pxLast = latLngToPixelSync(last.lat, last.lng);
      if (!pxLast) return;

      if (!previewLineEl) {
        previewLineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        previewLineEl.setAttribute('class', 'bearing-preview-line');
        svgEl.appendChild(previewLineEl);
      }
      previewLineEl.setAttribute('x1', pxLast.x);
      previewLineEl.setAttribute('y1', pxLast.y);
      previewLineEl.setAttribute('x2', mx);
      previewLineEl.setAttribute('y2', my);

      // Show live bearing in status
      const cursorLatLng = pixelToLatLngSync(mx, my);
      if (cursorLatLng) {
        const deg = BearingGeo.bearing(last.lat, last.lng, cursorLatLng.lat, cursorLatLng.lng);
        const cardinal = BearingGeo.cardinalDirection(deg);
        const dist = BearingGeo.distance(last.lat, last.lng, cursorLatLng.lat, cursorLatLng.lng);
        const hint = waypoints.length === 1 ? 'click to place end point' : 'click to add waypoint';
        setStatus(deg.toFixed(1) + '\u00B0 ' + cardinal + '  \u00B7  ' + BearingGeo.formatDistance(dist) + '  \u2014  ' + hint);
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
    dragging = parseInt(handle.dataset.point, 10);
    overlay.classList.add('dragging');

    const onMouseUp = () => {
      dragging = null;
      overlay.classList.remove('dragging');
      document.removeEventListener('mouseup', onMouseUp);
      setStatus('Drag markers to adjust \u00B7 click map to add waypoints \u00B7 double-click middle marker to remove');
    };
    document.addEventListener('mouseup', onMouseUp);
  }

  // === SVG rendering ===
  function clearSVG() {
    const defs = svgEl.querySelector('defs');
    while (svgEl.firstChild) {
      svgEl.removeChild(svgEl.firstChild);
    }
    if (defs) svgEl.appendChild(defs);
    previewLineEl = null;
  }

  function waypointColor(idx) {
    if (idx === 0) return COLOR_START;
    if (idx === waypoints.length - 1) return COLOR_END;
    return COLOR_MID;
  }

  function waypointLabel(idx) {
    if (idx === 0) return 'A';
    if (idx === waypoints.length - 1) return 'B';
    return String(idx);
  }

  function createMarkerGroup(x, y, idx, draggable) {
    const ns = 'http://www.w3.org/2000/svg';
    const color = waypointColor(idx);
    const label = waypointLabel(idx);
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');

    // Pulse ring
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
    const cls = 'bearing-marker' + (draggable ? ' bearing-marker-handle' : '');
    circle.setAttribute('class', cls);
    if (draggable) {
      circle.dataset.point = String(idx);
    }
    g.appendChild(circle);

    // Label text
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '0.5');
    text.setAttribute('class', 'bearing-marker-label');
    text.textContent = label;
    g.appendChild(text);

    // Drag hint
    if (draggable) {
      const hint = document.createElementNS(ns, 'text');
      hint.setAttribute('x', '0');
      hint.setAttribute('y', '22');
      hint.setAttribute('class', 'bearing-drag-hint');
      hint.textContent = '\u2725';
      g.appendChild(hint);
    }

    // Double-click remove hint for intermediate waypoints
    if (draggable && idx > 0 && idx < waypoints.length - 1) {
      circle.setAttribute('class', 'bearing-marker bearing-marker-handle bearing-marker-removable');
    }

    return g;
  }

  function drawLegWithLabel(pxFrom, pxTo, legBearing) {
    const ns = 'http://www.w3.org/2000/svg';

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', pxFrom.x);
    line.setAttribute('y1', pxFrom.y);
    line.setAttribute('x2', pxTo.x);
    line.setAttribute('y2', pxTo.y);
    line.setAttribute('class', 'bearing-line');
    svgEl.appendChild(line);

    const midX = (pxFrom.x + pxTo.x) / 2;
    const midY = (pxFrom.y + pxTo.y) / 2;
    const angle = Math.atan2(pxTo.y - pxFrom.y, pxTo.x - pxFrom.x) * 180 / Math.PI;

    // Arrow group
    const arrowG = document.createElementNS(ns, 'g');
    arrowG.setAttribute('transform', 'translate(' + midX + ',' + midY + ') rotate(' + angle + ')');
    const arrowPath = document.createElementNS(ns, 'path');
    arrowPath.setAttribute('d', 'M-8,-6 L8,0 L-8,6 Z');
    arrowPath.setAttribute('fill', COLOR_LINE);
    arrowPath.setAttribute('stroke', '#fff');
    arrowPath.setAttribute('stroke-width', '1.5');
    arrowPath.setAttribute('class', 'bearing-arrow');
    arrowG.appendChild(arrowPath);
    svgEl.appendChild(arrowG);

    // Per-leg label positioned above midpoint
    const cardinal = BearingGeo.cardinalDirection(legBearing);
    const labelG = document.createElementNS(ns, 'g');
    labelG.setAttribute('transform', 'translate(' + midX + ',' + midY + ')');

    const labelBg = document.createElementNS(ns, 'rect');
    const labelText = legBearing.toFixed(1) + '\u00B0 ' + cardinal;
    // Approximate width
    const approxW = labelText.length * 6.5 + 10;
    labelBg.setAttribute('x', String(-approxW / 2));
    labelBg.setAttribute('y', '-22');
    labelBg.setAttribute('width', String(approxW));
    labelBg.setAttribute('height', '16');
    labelBg.setAttribute('rx', '3');
    labelBg.setAttribute('fill', 'rgba(255,255,255,0.9)');
    labelBg.setAttribute('class', 'bearing-leg-label-bg');
    labelG.appendChild(labelBg);

    const labelTxt = document.createElementNS(ns, 'text');
    labelTxt.setAttribute('x', '0');
    labelTxt.setAttribute('y', '-11');
    labelTxt.setAttribute('class', 'bearing-leg-label');
    labelTxt.textContent = labelText;
    labelG.appendChild(labelTxt);

    svgEl.appendChild(labelG);
  }

  // Async render
  async function renderAll() {
    clearSVG();
    if (waypoints.length === 0) return;

    const pixels = [];
    for (const wp of waypoints) {
      const px = await latLngToPixel(wp.lat, wp.lng);
      pixels.push(px);
    }

    // Draw legs
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (!pixels[i] || !pixels[i + 1]) continue;
      const legBearing = BearingGeo.bearing(
        waypoints[i].lat, waypoints[i].lng,
        waypoints[i + 1].lat, waypoints[i + 1].lng
      );
      drawLegWithLabel(pixels[i], pixels[i + 1], legBearing);
    }

    // Draw markers on top of lines
    const inResult = state === 'RESULT';
    for (let i = 0; i < waypoints.length; i++) {
      if (!pixels[i]) continue;
      const draggable = inResult || waypoints.length >= 2;
      const mg = createMarkerGroup(pixels[i].x, pixels[i].y, i, draggable);
      svgEl.appendChild(mg);
    }
  }

  // Sync render (drag)
  function renderAllSync() {
    clearSVG();
    if (waypoints.length === 0) return;

    const pixels = waypoints.map(wp => latLngToPixelSync(wp.lat, wp.lng));

    // Draw legs
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (!pixels[i] || !pixels[i + 1]) continue;
      const legBearing = BearingGeo.bearing(
        waypoints[i].lat, waypoints[i].lng,
        waypoints[i + 1].lat, waypoints[i + 1].lng
      );
      drawLegWithLabel(pixels[i], pixels[i + 1], legBearing);
    }

    // Draw markers
    for (let i = 0; i < waypoints.length; i++) {
      if (!pixels[i]) continue;
      const mg = createMarkerGroup(pixels[i].x, pixels[i].y, i, true);
      svgEl.appendChild(mg);
    }
  }

  // === Result display ===
  function showResult() {
    if (waypoints.length < 2) return;

    while (resultPanel.firstChild) {
      resultPanel.removeChild(resultPanel.firstChild);
    }

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'bearing-clear-btn';
    clearBtn.title = 'Clear measurement';
    clearBtn.setAttribute('aria-label', 'Clear measurement');
    clearBtn.textContent = '\u00D7';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearMeasurement();
    });
    resultPanel.appendChild(clearBtn);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'bearing-copy-btn';
    copyBtn.title = 'Copy results to clipboard';
    copyBtn.setAttribute('aria-label', 'Copy results');
    copyBtn.textContent = 'Copy';
    resultPanel.appendChild(copyBtn);

    let totalDist = 0;
    const legs = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const wp1 = waypoints[i];
      const wp2 = waypoints[i + 1];
      const deg = BearingGeo.bearing(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
      const cardinal = BearingGeo.cardinalDirection(deg);
      const dist = BearingGeo.distance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
      const decl = MagDeclination.getDeclination((wp1.lat + wp2.lat) / 2, (wp1.lng + wp2.lng) / 2);
      const magDeg = ((deg - decl) + 360) % 360;
      const magCardinal = BearingGeo.cardinalDirection(magDeg);

      legs.push({ deg, cardinal, dist, decl, magDeg, magCardinal, wp1, wp2 });
      totalDist += dist;
    }

    // Render each leg
    legs.forEach((leg, i) => {
      const legEl = document.createElement('div');
      legEl.className = 'bearing-leg' + (legs.length > 1 ? ' bearing-leg-multi' : '');

      if (legs.length > 1) {
        const legHeader = document.createElement('div');
        legHeader.className = 'bearing-leg-header';
        legHeader.textContent = 'Leg ' + (i + 1);
        legEl.appendChild(legHeader);
      }

      const heading = document.createElement('div');
      heading.className = 'bearing-result-heading';

      const degreesSpan = document.createElement('span');
      degreesSpan.className = 'bearing-degrees';
      degreesSpan.textContent = leg.deg.toFixed(1) + '\u00B0';

      const cardinalSpan = document.createElement('span');
      cardinalSpan.className = 'bearing-cardinal';
      cardinalSpan.textContent = leg.cardinal;

      const trueLabel = document.createElement('span');
      trueLabel.className = 'bearing-true-label';
      trueLabel.textContent = '(true)';

      heading.appendChild(degreesSpan);
      heading.appendChild(cardinalSpan);
      heading.appendChild(trueLabel);
      legEl.appendChild(heading);

      // Magnetic bearing row
      const magRow = document.createElement('div');
      magRow.className = 'bearing-mag-row';

      const magDegSpan = document.createElement('span');
      magDegSpan.className = 'bearing-mag-degrees';
      magDegSpan.textContent = leg.magDeg.toFixed(1) + '\u00B0';

      const magCardinalSpan = document.createElement('span');
      magCardinalSpan.className = 'bearing-mag-cardinal';
      magCardinalSpan.textContent = leg.magCardinal;

      const magLabel = document.createElement('span');
      magLabel.className = 'bearing-mag-label';
      magLabel.textContent = '(mag)';

      const declNote = document.createElement('span');
      declNote.className = 'bearing-decl-note';
      declNote.textContent = 'Decl: ' + MagDeclination.formatDeclination(leg.decl);

      magRow.appendChild(magDegSpan);
      magRow.appendChild(magCardinalSpan);
      magRow.appendChild(magLabel);
      magRow.appendChild(declNote);
      legEl.appendChild(magRow);

      // Distance
      const distDiv = document.createElement('div');
      distDiv.className = 'bearing-distance';
      distDiv.textContent = BearingGeo.formatDistance(leg.dist);
      legEl.appendChild(distDiv);

      // Coords
      const coordsDiv = document.createElement('div');
      coordsDiv.className = 'bearing-coords';
      coordsDiv.textContent =
        leg.wp1.lat.toFixed(5) + ', ' + leg.wp1.lng.toFixed(5) +
        '  \u2192  ' +
        leg.wp2.lat.toFixed(5) + ', ' + leg.wp2.lng.toFixed(5);
      legEl.appendChild(coordsDiv);

      resultPanel.appendChild(legEl);
    });

    // Total distance (only if multi-leg)
    if (legs.length > 1) {
      const totalDiv = document.createElement('div');
      totalDiv.className = 'bearing-total-distance';

      const totalLabel = document.createElement('span');
      totalLabel.className = 'bearing-total-label';
      totalLabel.textContent = 'Total: ';
      totalDiv.appendChild(totalLabel);

      const totalVal = document.createElement('span');
      totalVal.className = 'bearing-total-value';
      totalVal.textContent = BearingGeo.formatDistance(totalDist);
      totalDiv.appendChild(totalVal);

      resultPanel.appendChild(totalDiv);
    }

    // Wire copy button
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyResults(legs, totalDist);
    });

    resultPanel.classList.add('visible');
  }

  function copyResults(legs, totalDist) {
    const lines = [];
    legs.forEach((leg, i) => {
      const prefix = legs.length > 1 ? ('Leg ' + (i + 1) + ': ') : '';
      lines.push(
        prefix +
        'Bearing: ' + leg.deg.toFixed(1) + '\u00B0 ' + leg.cardinal + ' (true) / ' +
        leg.magDeg.toFixed(1) + '\u00B0 ' + leg.magCardinal + ' (mag)' +
        ' | Distance: ' + BearingGeo.formatDistance(leg.dist) +
        ' | From: ' + leg.wp1.lat.toFixed(5) + ',' + leg.wp1.lng.toFixed(5) +
        ' | To: ' + leg.wp2.lat.toFixed(5) + ',' + leg.wp2.lng.toFixed(5)
      );
    });
    if (legs.length > 1) {
      lines.push('Total distance: ' + BearingGeo.formatDistance(totalDist));
    }
    const text = lines.join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showCopiedConfirmation();
    }).catch(() => {
      // Fallback: create a transient textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopiedConfirmation();
    });
  }

  function showCopiedConfirmation() {
    // Find the copy button in the result panel
    const copyBtn = resultPanel.querySelector('.bearing-copy-btn');
    if (!copyBtn) return;
    const origText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('bearing-copy-btn-success');
    setTimeout(() => {
      copyBtn.textContent = origText;
      copyBtn.classList.remove('bearing-copy-btn-success');
    }, 1800);
  }

  function hideResult() {
    resultPanel.classList.remove('visible');
  }

  function clearMeasurement() {
    waypoints = [];
    clearSVG();
    hideResult();
    if (isActive) {
      state = 'PLACING';
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
        if (waypoints.length > 0) {
          await renderAll();
          if (waypoints.length >= 2) showResult();
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
      if (state === 'RESULT' || waypoints.length > 0) {
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
