'use strict';

/**
 * Stores the ID of the currently active tab and the visualizer tab
 * @type {number|null}
 */
let activeTabId = null;
/**
 * Stores the ID of the visualizer tab
 * @type {number|null}
 */
let visualizerTabId = null;


// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;
});


// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : activeTabId;

  if (!tabId) {
    sendResponse({ error: 'No valid tab ID found' });
    return false;
  }

  if (request.action === "createVisualizerTab") {
    // Check if visualizer tab already exists
    if (visualizerTabId) {
      // Focus existing tab instead of creating new one
      chrome.tabs.update(visualizerTabId, { active: true }, () => {
        if (chrome.runtime.lastError) {
          // Tab doesn't exist anymore, create new one
          createNewVisualizerTab(sendResponse);
        } else {
          sendResponse({ success: true, tabId: visualizerTabId });
        }
      });
      return true;
    }
    createNewVisualizerTab(sendResponse);
    return true;
  }

  if (request.action === "visualizeJson") {
    try {
      // Ensure visualizer tab exists
      if (!visualizerTabId) {
        sendResponse({ error: "Visualizer tab not created" });
        return false;
      }

      chrome.tabs.sendMessage(visualizerTabId, {
        action: "visualizeJson",
        json: request.json
      }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          chrome.tabs.update(visualizerTabId, { active: true });
          sendResponse({ success: true, data: response });
        }
      });
      return true; // Will respond asynchronously
    } catch (error) {
      sendResponse({ error: error.message });
      return false;
    }
  }
  return false;
});

/**
 * Creates a new visualizer tab and sends a response with the tab ID
 * @param {Function} sendResponse
 */

function createNewVisualizerTab(sendResponse) {
  chrome.tabs.create({
    url: 'visualizer.html',
    active: false
  }, (tab) => {
    visualizerTabId = tab.id;
    sendResponse({ success: true, tabId: tab.id });
  });
}

// Clean up tab ID on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === visualizerTabId) {
    visualizerTabId = null;
  }
});

// Handle installation/update events
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
});
