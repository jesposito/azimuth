(function() {
  'use strict';

  const toggle = document.getElementById('toggle');

  // Load saved state
  chrome.storage.local.get('bearingActive', (result) => {
    toggle.checked = result.bearingActive || false;
  });

  toggle.addEventListener('change', () => {
    const active = toggle.checked;
    chrome.storage.local.set({ bearingActive: active });

    // Notify background to relay to content script
    chrome.runtime.sendMessage({
      type: 'TOGGLE_BEARING_TOOL',
      active
    });
  });
})();
