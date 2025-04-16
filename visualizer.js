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

/**
 * Transforms HTML data into network graph structure with nodes and links
 * @param {Object} jsonData - The JSON Representation OF THE HTML
 * @returns {Object} An object of nodes and links for the network graph
 * @returns {Array} An array of node objects representing HTML elements
 * @returns {Array} An array of link objects representing relationships between nodes
 */

function transformData(jsonData) {
    // Create nodes and link arrays for the network graph
    const nodes = [];
    const links = [];
    let nodeId = 0;

    // Add root node
    nodes.push({
        id: nodeId,
        name: 'HTML',
        type: 'root',
        level: 0,
        data: { content: 'Root node'}
    });

    // Proces tags as communities 
    Object.entries(jsonData).forEach(([tag, elements], tagIndex) => {
        const tagNodeId = ++nodeId;

        //Add tag node
        nodes.push({
            id: tagNodeId,
            name: tag.toUpperCase(),
            type: 'tag',
            level: 1,
            data: {
                tag: tag,
                count: elements.length,
                content: `${elements.length} elements`
            }
        });

        // Link to root
        links.push({
            source: 0,
            target: tagNodeId,
            value: 1,
            type: 'contains'
        });

        // Process elements
        elements.forEach((element, elementIndex) => {
            const elementNodeId = ++nodeId;

            // Add element node
            nodes.push({
                id: elementNodeId,
                name: `${tag}#${elementIndex}`,
                type: 'element',
                level: 2,
                data: {
                    tag: tag,
                    attributes: element.attributes,
                    content: element.innerText
                }
            });

            // Link to tag group
            links.push({
                source: tagNodeId,
                target: elementNodeId,
                value: 1,
                type: 'contains'
            });
        });
    });

    return { nodes, links };
    
}

// Creates a D3.js visualization of data, clears any existing visualizations,
// sets up the SVG container and applies zoom behavior

function createVisualization(data) {
    // Clear any existing vis
    d3.select('#chart').selectAll("*").remove();

    // Create SVG container
    const svg = d3.select("chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    // Add zoom behavior
    const g = svg.append("g");
    svg.call(d3.zoom()
        .extent([[0, 0]. width, height])
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => g.attr("transform", event.transform)));
    
    // Create the selected layout
    layouts[selectedLayout](data, g);
}

/**
 * Draws nodes and links for the network graph
 * TODO: Fix value Links not read
 * @param {Object} data 
 * @param {Object} g
 * @param {Array} data.links
 * @param {Array} data.nodes
 */

function drawNodesAndLinks(data, g) {
    const links = g.selectAll(".link")
        .data("line")
        .join("class", "link")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.source.x)
        .attr("y2", d => d.source.y);

        const nodes = g.selectAll(".node")
            .data(data.nodes)
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x}, ${d.y})`);

        nodes.append("circle")
            .attr("r", d => getNodeSize(d))
            .style("fill", d => getNodeColor(d));

        nodes.append("text")
            .attr("dx", 12)
            .attr("dy", ".35em")
            .text(d => d.name);
}

/**
 * Transforms the data into a hierarchical structure
 * @param {Object} data
 * @returns {Object}
 */

function transformToHierarchy(data) {
    return {
        name: "root",
        children: Object.entries(data.nodes).map(([key, value]) => ({
            name: key,
            children: value
        }))
    };
}
/**
 * Determines the size of a node based on whether it has children
 * @param {Object} d - The node data object
 * @returns {number} The size of the node
 */

function getNodeSize(d) {
    return d.children ? 8 : 5;
}
/**
 *Determines the color of a node based on whether it has children
 * @param {Object} d - The node data object
 * @returns {string} The color of the node
 */

function getNodeColor(d) {
    return d.children ? "#1a73e8" : "#34a853";
}
/**
 *Converts JSON to CSV format
 NOTE: Currently not implemented
 TODO: Implement
 * @param {Object} data - The JSON data object
 * @returns {string} The CSV representation of the data
 */

function convertToCSV(data) {
    // Convert JSON data to CSV
    const items = [];
    for (const [tag, elements] of Object.entries(data)) {
        elements.forEach((el, idx) => {
            items.push({
                tag: tag,
                id: `${tag}-${idx}`,
                attributes: JSON.stringify(el.attributes),
                content: el.innerText
            });
        });
    }

    const header = ['tag', 'id', 'attributes', 'content'];
    const csv = [
        header.join(','),
        ...items.map(row => header.map(field =>
            `"${String(row[field]).replace(/"/g, '""')}"`)
        .join(','))
    ].join('\n');

    return csv;
}

/**
 * Converts a network of nodes and links into csv format
 * NOTE: Currently not implemented
 * TODO: Implement
 * @param {Array} nodes
 * @param {Array} links
 * @returns {Object}
 * @returns {string} Nodes
 * @returns {string} Edges aka links
 */

function convertNetworkToCSV(nodes, links) {
    // Create nodes CSV
    const nodesHeader = ['id', 'type', 'attributes'];
    const nodesCSV = [
        nodesHeader.join(','),
        ...nodes.map(node =>
            `"${node.id}","${node.type}","${JSON.stringify(node.data || {}).replace(/"/g, '""')}"`)
    ].join('\n');

    // Create edges CSV
    const edgesHeader = ['source', 'target', 'relationship'];
    const edgesCSV = [
        edgesHeader.join(','),
        ...links.map(link =>
            `"${link.source.id}","${link.target.id}","${link.type || 'contains'}"`)
    ].join('\n');

    return {
        nodes: nodesCSV,
        edges: edgesCSV
    };
}
/**
 * Downloads the CSV content as file with file name
 * NOTE: Currently not implemented
 * TODO: Implement
 * @param {string} content - The CSV content to be downloaded
 * @param {string} filename - The name of the CSV file
 */

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Displays information about a node in an info box
 * NOTE: Currently not implemented
 * TODO: Implement
 * @param {Object} node
 * @param {Event} event
 */

function showNodeInfo(node, event) {
    const infoBox = document.getElementById('info-box');
    let content = `<h3>${node.name}</h3>`;

    if (node.data) {
        if (node.data.attributes) {
            content += '<h4>Attributes:</h4>';
            content += '<ul>';
            for (const [key, value] of Object.entries(node.data.attributes)) {
                content += `<li><strong>${key}:</strong> ${value}</li>`;
            }
            content += '</ul>';
        }
        if (node.data.content) {
            content += '<h4>Content:</h4>';
            content += `<p>${node.data.content}</p>`;
        }
    }

    infoBox.innerHTML = content;
    infoBox.style.display = 'block';
}

/**
 * Displays a tooltip containg information about a selected or hovered over node
 * @param {Event} event
 * @param {Object} d - The node data object
 */

function showTooltip(event, d) {
    const tooltip = d3.select("#tooltip");
    tooltip.transition()
        .duration(200)
        .style("opacity", .9);

    let content = `<strong>${d.data.name}</strong><br/>`;
    if (d.data.attributes) {
        content += '<h4>Attributes:</h4><ul>';
        Object.entries(d.data.attributes).forEach(([key, value]) => {
            content += `<li>${key}: ${value}</li>`;
        });
        content += '</ul>';
    }
    if (d.data.content) {
        content += `<h4>Content:</h4><p>${d.data.content}</p>`;
    }

    tooltip.html(content)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function hideTooltip() {
    d3.select("#tooltip")
        .transition()
        .duration(500)
        .style("opacity", 0);
}

// Add layout selector
d3.select("#chart")
    .insert("div", ":first-child")
    .attr("class", "layout-controls")
    .html(`
        <label for="layout-select">Choose layout: </label>
        <select id="layout-select">
            <option value="force">Force-Directed</option>
            <option value="radial">Radial</option>
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
        </select>
    `);

d3.select("#layout-select").on("change", function() {
    selectedLayout = this.value;
    if (currentData) {
        createVisualization(currentData);
    }
});

/**
 *Downloads file with conetnt, filename and content type
 * @param {string} content
 * @param {string} fileName
 * @param {string} contentType
 */

function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
/**
 * Changes current layout and updates visualization if data is available
 * @param {string} layoutName
 */

// Update layout selection handler
function changeLayout(layoutName) {
    currentLayout = layoutName;
    if (currentData) {
        updateVisualization(currentData);
    }
}
/**
 * Downloads the data as a JSON file with specified filename
 * @param {Object} data
 * @param {String} filename
 */

function downloadAsJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
/**
 *Downloads network data as JSON file
 * @param {Array} nodes
 * @param {Array} links
 */

function downloadAsNetwork(nodes, links) {
    const networkData = {
        nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            level: n.level,
            data: n.data,
            x: n.x,
            y: n.y
        })),
        links: links.map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target,
            value: l.value
        }))
    };
    downloadAsJson(networkData, 'network-data.json');
}

// Update layout functions for different visualizations
const layouts = {
    force: (data) => {
        simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-1000))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(30));
        return { nodes: data.nodes, links: data.links };
    },
    radial: (data) => {
        // Calculate larger radius based on node count
        const nodeCount = data.nodes.length;
        const radius = Math.min(width, height) / 1.5 - 100; // Increased from /2 to /1.5
        const spacingFactor = Math.max(1, Math.log2(nodeCount) / 10);

        data.nodes.forEach((node, i) => {
            const angle = (i * 2 * Math.PI) / data.nodes.length;
            // Apply spacing factor to radius
            const adjustedRadius = radius * spacingFactor;
            node.x = width/2 + adjustedRadius * Math.cos(angle);
            node.y = height/2 + adjustedRadius * Math.sin(angle);
        });

        return { nodes: data.nodes, links: data.links };
    }
};
/**
 *Transforms data to a hierarchical structure
 * @param {Object} data
 * @returns {Object} A hierarchical structure of the data
 */

function transformToHierarchy(data) {
    return {
        name: "root",
        children: data.nodes.map(node => ({
            name: node.id,
            data: node.data,
            children: node.children || []
        }))
    };
}

// Add event listeners for downloads
d3.select("#download-json").on("click", () => {
    if (currentData) {
        downloadAsJson(currentData, 'visualization-data.json');
    }
});

d3.select("#download-network").on("click", () => {
    if (simulation) {
        downloadAsNetwork(simulation.nodes(), simulation.force("link").links());
    }
});

// Update visualization when layout changes
d3.select("#layout-select").on("change", function() {
    currentLayout = this.value;
    if (currentData) {
        updateVisualization(currentData);
    }
});

// Add gravity control listener
d3.select("#gravity").on("input", function() {
    if (currentLayout === 'force' && currentData) {
        updateVisualization(currentData);
    }
});

// Add event listener for gravity slider
d3.select("#gravity-slider").on("input", function() {
    gravity = -this.value * 100; // Scale slider value
    if (simulation && currentLayout === 'force') {
        simulation.force("charge", d3.forceManyBody().strength(gravity));
        simulation.alpha(0.3).restart(); // Restart simulation with new gravity
    }
});