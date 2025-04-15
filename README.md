# HTML_To_JSON_Network_Mapper
Converts HTML data from a webpage into JSON , generating a network map to visualize relationships between different elements on the webpage. 

## Overview
Converts HTML DOM structures into JSON and provides interactive network with force-directed visualizations using D3.min.js with community detection with Louvain algorithm. Users can interact with network graph and download JSON data of the whole network, including node and edges data or select certain nodes to download directly connected node data. 

### Data Flow

```mermaid
---
config:
  theme: dark
  look: neo
  layout: elk

flowchart TD
    A["Webpage DOM"] -- "content.js" --> B["HTML Parser"]
    B -- JSON Structure --> C["Background Script"]
    C -- Message Passing --> D["Visualizer Tab"]
    D -- "D3.js" --> E["Force Layout"] & F["Radial Layout"]
    D -- "Louvain.js" --> G["Community Detection"]
    H["User Input"] -- Layout Controls --> D
    H -- Gravity Slider --> E
    H -- Community Toggle --> G
    H -- Zoom/Pan --> D
    I["JSON Data"] -- Download --> D
    D -- Network Data --> I
    G -- Community Data --> I


```