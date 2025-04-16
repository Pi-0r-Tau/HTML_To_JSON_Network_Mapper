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

function resetHighlight() {
    d3.selectAll('.node') .style('opacity', 1);
    d3.selectAll('.link') .style('opacity', 1);
    d3.select('#download-connected').style('display', 'none');
}

function setupControls() {
    const controls = d3.select("#controls");

    // Add search input
    const searchInput = controls.append("input")
        .attr("type", "text")
        .attr("id", "search-input")
        .attr("placeholder", "search nodes...")
        .style("margin-right", "10px");

    // Add layout selector
    controls.append("select")
        .attr("id", "layout-select")
        .selectAll("option")
        .data(Object.keys(layoutFunctions))
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);

    // Add search behavior
    searchInput.on("input", function() {
        const searchTerm = this.value.toLowerCase();

        // Update node visibility
        d3.selectAll(".node")
            .style("opacity", d => {
                const content = d.data?.content || d.data?.name || d.name || "";
                return content.toLowerCase().includes(searchTerm) ? 1 : 0.2;
            });

        // Update link visibility
        d3.selectAll(".link")
            .style("opacity", d => {
                const sourceContent = d.source.data?.content || d.source.name || "";
                const targetContent = d.target.data?.content || d.target.name || "";
                return sourceContent.toLowerCase().includes(searchTerm) || targetContent.toLowerCase().includes(searchTerm) ? 0.6 : 0.1;
            });

    });

    // Add layout change behavior
    d3.select("#layout-select").on("change", function() {
        currentLayout = this.value;
        if (currentData) {
            updateVisualization(currentData)
        }
    });
        
}

// Add search functionality 
d3.select("#search")
    .on("input", function() {
        const searchTerm = this.value.toLowerCase();

        d3.selectAll(".node")
            .style("opacity", d => {
                // Search in node content and attributes
                const content = d.data?.content || "";
                const attributes = d.data?.attributes ?
                    Object.entries(d.data.attributes)
                        .map(([key, value]) => `${key}=${value}`)
                        .join(" ") : "";
                const searchText = `${d.name} ${content} ${attributes}`.toLowerCase();

                return searchText.includes(searchTerm) ? 1 : 0.1;
            });

            // Update links visibility
            d3.selectAll(".link")
                .style("opacity", d => {
                    const sourceContent = d.source.data?.content || "";
                    const targetContent = d.target.data?.content || "";
                    const sourceMatch = sourceContent.toLowerCase().includes(searchTerm);
                    const targetMatch = targetContent.toLowerCase().includes(searchTerm);

                    return (sourceMatch || targetMatch) ? 0.6 : 0.1;
                });
    });

    function detectCommunities(nodes, links) {
        const community = jLouvain()
            .nodes(nodes.map(node => node.id))
            .edges(links.map(link => ({
                source: link.source.id,
                target: link.target.id,
                weight: 1
            })));
        
        const result = community();

        // Assign communities back to nodes
        nodes.forEach(node => {
            node.community = result[node.id];
        });

        return nodes;
    }