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

/**
 * Highlights nodes and links connected directly to the selected node, updating their
 * opacity, also adding a download btn for connected node data
 * @param {Object} selectedNode - The node object selected by the user
 * @param {Array} nodes - An array of node objects
 * @param {Array} links - An array of link objects 
 */

function highlightConnectedNodes(selectedNode, nodes, links) {
    // Find all nodes connected to the selected node
    const connectedNodeIds = new Set([selectedNode.id]);
    links.forEach(link => {
        if (link.source.id === selectedNode.id) connectedNodeIds.add(link.target.id);
        if (link.target.id === selectedNode.id) connectedNodeIds.add(link.source.id);
    });

    // Update opacity for nodes and links
    d3.selectAll('.node')
        .style('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0.1);

    d3.selectAll('link')
        .style('opacity', d =>
            connectedNodeIds.has(d.source.id) && connectedNodeIds.has(d.target.id) ? 1 : 0.1);
    
    // Download button for connected nodes
    const downloadBtn = d3.select('#download-connected')
            .style('display', 'block')
            .on('click', () => downloadConnectedData(selectedNode, nodes, links, connectedNodeIds));
}

/**
 * Downloads the data of nodes and links connected to the selected node as a JSON file
 * @param {Object} selectedNode  - The node object that is selected by user
 * @param {Array} nodes 
 * @param {Array} links 
 * @param {Set} connectedNodeIds - A set of IDs of nodes connected to the selected node
 */

function downloadConnectedData(selectedNode, nodes, links, connectedNodeIds) {
    const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
    const connectedLinks = links.filter(l => 
        connectedNodeIds.has(l.source.id) && connectedNodeIds.has(l.target,id));

    const data = {
        centralNode: selectedNode,
        connectedNodes: connectedNodes,
        links: connectedLinks
    };

    downloadAsJson(data, `node-${selectedNode.id}-connections.json`);

    
}