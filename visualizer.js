'use strict';

// Initialize global variables
const width = window.innerWidth;
const height = window.innerHeight;
let simulation = null;
let currentLayout = 'force';
let currentData = null;
const color = d3.scaleOrdinal(d3.schemeCategory10);
let gravity = -1000; // Default gravity value

// Define layout functions
const layoutFunctions = {
    force: (data) => {
        if (simulation) simulation.stop();

        const gravityStrength = document.getElementById('gravity').value;

        simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(gravity))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("gravity", d3.forceManyBody().strength(gravityStrength * 100))
            .force("collide", d3.forceCollide(30));

        return data;
    },
    /**
     * Creates a radial layout for the data using D3.js
     * @param {Object} data - The data object containing nodes
     * @param {Array} data.nodes - An array of node objects
     * @returns {Object} The input data object with updated node positions
     */
    radial: (data) => {
        if (simulation) simulation.stop();

        const nodes = data.nodes;
        const nodesByLevel = new Map();

        // Group nodes by their level
        nodes.forEach(node => {
            if (!nodesByLevel.has(node.level)) {
                nodesByLevel.set(node.level, []);
            }
            nodesByLevel.get(node.level).push(node);
        });

        // Calculate radius for each level
        const maxLevel = Math.max(...nodesByLevel.keys());
        const radiusStep = Math.min(width, height) / (2 * (maxLevel + 2));

        // Position nodes in concentric circles
        nodesByLevel.forEach((levelNodes, level) => {
            const radius = (level + 1) * radiusStep;
            const angleStep = 2 * Math.PI / levelNodes.length;

            levelNodes.forEach((node, i) => {
                const angle = i * angleStep;
                node.x = width/2 + radius * Math.cos(angle);
                node.y = height/2 + radius * Math.sin(angle);
            });
        });

        return data;
    }
};