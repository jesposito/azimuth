(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
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
  });

  // Restore badge on startup
  chrome.storage.local.get('bearingActive', (result) => {
    if (result.bearingActive) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
    }
  });
})();
