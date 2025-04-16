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

    /**
     * Detects communities within a network of nodes and links using JLouvain algorithm
     * @param {Array} nodes 
     * @param {Array} links 
     * @returns {Array} The input array of nodes with an added community property, indicating the 
     * community the node belongs to.
     */

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

    /**
     * 
     * @param {Object} data 
     * @returns {Object|Null} An object containing the nodes, links and the D3 simulationor null if data structure is invalid
     */
    function createForceLayout(data) {
        if (!data || !data.nodes || !data.links) {
            console.error('Invalid data structure:', data);
            return null;
        }

        const simulation = d3.forceSimulation(data,nodes)
            .force("link", d3.forceLink(data.links)
                .id(d => d.id)
                .distance(100))
            .force("charge", d3.forceManyBody()
                .strength(-1000))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(30));

        return {
            nodes: data.nodes,
            links: data.links,
            simulation: simulation
        };
    }

    /**
     * Creates a radial layout for hierarchical data using D3.min.js
     * @param {Object} data 
     * @returns {Array} An array of node objects with radial coordinates
     */

    function createRadialLayout(data) {
        const radius = Math.min(width, height) / 2 - 100;

        const layout = d3.cluster()
            .size([360, radius]);

        const root = d3.hierarchy(data);
        layout(root);

        // Convert to radial coordinates
        return root.descendants().map(d => {
            const angle = (d.x - 90) / 180 * Math.PI;
            return {
                ...d,
                x: d.y * Math.cos(angle) + width/2,
                y: d.y * Math.sin(angle) + height/2
            };
        });
    } 

    /**
     * Creates a tree layout for hierarchical data, NOT IMPLEMENTED 
     * TODO: Implement 
     * @param {Object} data
     * @returns {Array} An array of node objects with tree layout coordinates 
     */

    function createTreeLayout(data) {
        const layout = d3.tree()
            .size([width - 100, height - 100]);

        const root = d3.hierarchy(data);
        return layout(root).descendants();
    }

    /** 
     * Creates a cluster layout for hierarchical  data, NOT IMPLEMENTED
     * TODO: Implement 
     * @param {Object} data
     * @returns {Array}
     */

    function createClusterLayout(data) {
        const layout = d3.cluster()
            .size([width - 100, height - 100]);

        const root = d3.hierarchy(data);
        return layout(root).descendants();
    }

    function createPackLayout(data) {
        const layout = d3.pack()
            .size([width - 100, height - 100])
            .padding(3);

        const root = d3.hierarchy(data)
            .sum(d => d.value || 1);
        
        return layout(root).descendants();
    }

/**
 *Updates the visualization of the data using D3.js, clearing
 any previous visualization and applies the user selected layout
 * @param {Object} data
 * @param {Array} data.nodes
 * @param {Array} data.links
 * @returns {Object}
 */

function updateVisualization(data) {
    if (!data) return;
    currentData = data;

    // Clear previous visualization
    d3.select("#chart").selectAll("*").remove();

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g");

    // Add zoom behavior
    svg.call(d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => g.attr("transform", event.transform)));

    // Apply selected layout
    const layoutData = layoutFunctions[currentLayout](data);

    // Create links
    const link = g.selectAll(".link")
        .data(layoutData.links)
        .enter()
        .append("line")
        .attr("class", "link")
        .style("stroke", "#999")
        .style("stroke-width", 1);

    // Create nodes with proper labels
    const node = g.selectAll(".node")
        .data(layoutData.nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

    // Add circles to nodes
    node.append("circle")
        .attr("r", d => d.level === 0 ? 15 : d.level === 1 ? 10 : 5)
        .style("fill", d => color(d.type || d.depth));

    // Add visible labels
    node.append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .style("font-size", "10px")
        .style("fill", "white")
        .text(d => {
            if (d.data && d.data.name) return d.data.name;
            if (d.name) return d.name;
            return d.id || "";
        });

    // Add tooltips with detailed information
    node.append("title")
        .text(d => {
            let info = `Type: ${d.type || 'Node'}\n`;
            info += `Name: ${d.name || 'Unnamed'}\n`;
            if (d.data) {
                if (d.data.content) info += `Content: ${d.data.content}\n`;
                if (d.data.attributes) {
                    info += 'Attributes:\n';
                    Object.entries(d.data.attributes).forEach(([key, value]) => {
                        info += `  ${key}: ${value}\n`;
                    });
                }
            }
            return info;
        });

    // Update positions based on layout type
    if (currentLayout === 'force' && simulation) {
        simulation.nodes(layoutData.nodes)
            .on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node
                    .attr("transform", d => `translate(${d.x},${d.y})`);
            });

        simulation.force("link")
            .links(layoutData.links);
    } else {
        // Position nodes for static layouts
        node.attr("transform", d => `translate(${d.x},${d.y})`);

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    }

    // Update node click behavior
    node.on('click', (event, d) => {
        event.stopPropagation();
        highlightConnectedNodes(d, data.nodes, data.links);
    });

    // Add background click to reset
    svg.on('click', () => {
        resetHighlight();
    });
}

function dragStarted(event, d) {
    if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active && simulation) simulation.alphaTarget(0);
    d.fx = null;
    d.fy - null;
}

// Message handler 
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Visualizer received message:', request);

    if (request.action === "visualizeJson" && request.json) {
        currentData = request.json;
        const graphData = transformData(request.json);
        console.log('Transformed data:', graphData);
        updateVisualization(graphData);
        sendResponse({ success: true });
        return true;
    }
});

// Update on window resize
window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    if (currentData) {
        updateVisualization(currentData);
    }
});