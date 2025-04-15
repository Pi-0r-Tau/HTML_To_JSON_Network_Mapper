// Logs a messafe to console indicating content script has loaded
console.log("Content script loaded");

// Signal that content script is ready by sending message to background.js
chrome.runtime.sendMessage({ action: "contentScriptReady" });

/**
 * Converts HTML of current webpage to JSON representation
 * @returns {Object} A JSON object representing the HTML structure of the webpage.
 */
function htmlToJson() {
  const elements = document.body.getElementsByTagName("*");
  const json = {};

  for (let element of elements) {
    const tag = element.tagName.toLowerCase();
    if (!json[tag]) {
      json[tag] = [];
    }
    json[tag].push({
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      innerText: element.innerText
    });
  }

  return json;
}

// Error handling to mesage listener
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log("Message received in content script:", request);

    if (request.action === "convertHtmlToJson") {
        try {
            const jsonData = htmlToJson();
            sendResponse({success: true, json: jsonData});
        } catch (error) {
            sendResponse({error: error.message });
        }
        return true;
    }

    if (request.action === "visualizeJson") {
        try {
            sendResponse({ success: true});
        } catch (error) {
            sendResponse({ error: error.message });
        }
        return true;
    }

    return false;
});