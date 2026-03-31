(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TOGGLE_BEARING_TOOL') {
      // Relay to the active Google Maps tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SET_BEARING_ACTIVE',
            active: message.active
          });
        }
      });

      // Update badge
      chrome.action.setBadgeText({ text: message.active ? 'ON' : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
    }

    if (message.type === 'GEOCODE_NOMINATIM') {
      geocodeNominatim(message.query).then(sendResponse);
      return true; // keep channel open for async sendResponse
    }
  });

  /**
   * Geocode a query using OpenStreetMap's Nominatim API.
   * Free, no API key, reliable. Respects usage policy with User-Agent.
   */
  async function geocodeNominatim(query) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        addressdetails: '1',
      });
      const url = 'https://nominatim.openstreetmap.org/search?' + params.toString();
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AzimuthChromeExtension/1.0',
        },
      });
      if (!response.ok) {
        return { error: 'HTTP_' + response.status };
      }
      const results = await response.json();
      if (results && results.length > 0) {
        return {
          results: results.map(r => ({
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            displayName: r.display_name,
            type: r.type,
            importance: r.importance,
          })),
        };
      }
      return { error: 'NO_RESULTS' };
    } catch (err) {
      return { error: err.message };
    }
  }

  // Restore badge on startup
  chrome.storage.local.get('bearingActive', (result) => {
    if (result.bearingActive) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
    }
  });
})();
