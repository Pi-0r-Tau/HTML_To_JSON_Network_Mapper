
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const convertBtn = document.getElementById('convert');
    const visualizeBtn = document.getElementById('visualize');
    const jsonOutput = document.getElementById('jsonOutput');
    const errorDiv = document.getElementById('error');

    convertBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: "convertHtmlToJson"
            });

            if (response && response.json) {
                storedJsonData = response.json;
                jsonOutput.value = JSON.stringify(response.json, null, 2);
                visualizeBtn.disabled = false;
                errorDiv.textContent = '';
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            visualizeBtn.disabled = true;
        }
    });

    visualizeBtn.addEventListener('click', async () => {
        if (!storedJsonData) {
            errorDiv.textContent = 'No JSON data available. Convert HTML first.';
            return;
        }

        try {
            // Create the visualizer tab
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "createVisualizerTab"
                }, (response) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(response);
                });
            });

            // Short delay to ensure tab is ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Then send the visualization data
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: "visualizeJson",
                    json: storedJsonData
                }, (response) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(response);
                });
            });

        } catch (error) {
            errorDiv.textContent = error.message;
        }
    });

    // Initially disable visualize button
    visualizeBtn.disabled = true;
});
