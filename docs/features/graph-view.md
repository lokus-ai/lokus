# Graph View

Lokus features a sophisticated graph visualization system that shows the relationships between your notes, creating a visual knowledge map of your connected ideas and content. The graph view uses force-directed layout algorithms to create intuitive visualizations of your note network.

## Overview

The Graph View provides:
- **Visual knowledge mapping** - See connections between all your notes
- **Interactive exploration** - Click and drag to explore your knowledge graph
- **Force-directed layout** - Automatic positioning based on note relationships
- **Customizable appearance** - Adjust colors, sizes, and layout parameters
- **Performance optimization** - Efficient rendering for large note collections
- **Real-time updates** - Graph updates as you create and modify notes

## Opening Graph View

### Access Methods
- **Keyboard Shortcut**: `⌘⇧G` (macOS) / `Ctrl+Shift+G` (Windows/Linux)
- **Command Palette**: Search for "Show Graph View" in Command Palette (`⌘K`)
- **Sidebar Button**: Click the graph icon in the workspace toolbar
- **Menu**: View → Graph View

### Interface Layout
The Graph View opens in a modal overlay with:
- **Canvas Area** - Main visualization space
- **Control Panel** - Settings and customization options
- **Search Bar** - Find specific notes in the graph
- **Information Panel** - Details about selected nodes and connections

## Graph Elements

### Nodes (Notes)
Each note in your workspace appears as a node in the graph:

#### Node Properties
- **Size** - Proportional to note content length or number of connections
- **Color** - Based on note type, folder, or custom categories
- **Shape** - Different shapes for different content types
- **Label** - Note title displayed on or near the node

#### Node States
- **Default** - Standard appearance for unselected notes
- **Hovered** - Highlighted when mouse hovers over
- **Selected** - Emphasized when clicked or focused
- **Connected** - Highlighted when connected to selected node
- **Dimmed** - Faded when not related to current selection

### Edges (Links)
Connections between notes are shown as edges:

#### Link Types
- **Wiki Links** - Direct `[[Note Name]]` references between notes
- **Backlinks** - Reverse connections showing what links to each note
- **Tag Relationships** - Notes connected through shared tags
- **Folder Relationships** - Notes in the same folder structure

#### Edge Properties
- **Thickness** - Strength of connection (frequency of links)
- **Color** - Type of relationship or link strength
- **Style** - Solid, dashed, or dotted based on link type
- **Direction** - Arrows indicating link direction (optional)

## Graph Layout

### Force-Directed Algorithm
The graph uses advanced physics simulation:

#### Forces Applied
- **Repulsion** - Nodes push away from each other
- **Attraction** - Connected nodes pull toward each other
- **Centering** - Weak force keeping nodes in view
- **Collision** - Prevents nodes from overlapping

#### Layout Parameters
```javascript
{
  strength: -300,        // Node repulsion strength
  distance: 100,         // Preferred link distance
  iterations: 300,       // Simulation iterations
  alpha: 0.3,           // Simulation cooling rate
  alphaDecay: 0.0228,   // How quickly simulation settles
  velocityDecay: 0.4    // Velocity dampening
}
```

### Layout Customization
Users can adjust layout parameters:
- **Node Spacing** - How far apart nodes naturally settle
- **Link Strength** - How strongly connected notes attract
- **Repulsion Force** - How strongly unconnected notes repel
- **Simulation Speed** - How quickly the layout stabilizes

## Interactive Features

### Navigation
- **Pan** - Click and drag empty space to move around
- **Zoom** - Mouse wheel or pinch to zoom in/out
- **Fit to View** - Button to fit entire graph in view
- **Center on Node** - Double-click node to center view

### Node Interaction
- **Single Click** - Select node and show details
- **Double Click** - Open note in editor
- **Drag** - Temporarily pin node position
- **Right Click** - Context menu with note operations

### Selection and Filtering
- **Multi-select** - Hold Ctrl/Cmd and click multiple nodes
- **Neighborhood** - Show only connected notes
- **Search Filter** - Highlight nodes matching search terms
- **Tag Filter** - Show only notes with specific tags

## Graph Controls

### Appearance Settings

#### Node Customization
- **Size Mode** - Base node size on content length, connections, or fixed size
- **Color Scheme** - Choose from predefined color themes or custom colors
- **Label Settings** - Show/hide labels, adjust font size and style
- **Shape Options** - Circle, square, or custom shapes for different note types

#### Edge Customization
- **Link Visibility** - Show/hide different types of connections
- **Edge Thickness** - Adjust line thickness for better visibility
- **Curve Style** - Straight lines, curved edges, or automatic routing
- **Arrow Style** - Show/hide directional arrows on links

### Performance Settings

#### Optimization Options
- **Node Limit** - Maximum number of nodes to display
- **Update Frequency** - How often graph recalculates positions
- **Animation Quality** - Balance between smooth animation and performance
- **Background Rendering** - Use web workers for heavy calculations

#### Memory Management
- **Viewport Culling** - Hide nodes outside visible area
- **Level of Detail** - Reduce detail for distant nodes
- **Texture Caching** - Reuse rendered node textures
- **Garbage Collection** - Automatic cleanup of unused elements

## Graph Analysis

### Metrics and Statistics
The graph view provides insights about your knowledge network:

#### Node Metrics
- **Degree Centrality** - Number of connections each note has
- **Betweenness Centrality** - Notes that bridge different clusters
- **Closeness Centrality** - Notes that are close to all others
- **PageRank** - Importance based on incoming links

#### Graph Metrics
- **Total Nodes** - Number of notes in the graph
- **Total Edges** - Number of connections between notes
- **Clustering Coefficient** - How well-connected the graph is
- **Average Path Length** - Average distance between any two notes

### Cluster Detection
Automatic identification of note clusters:
- **Community Detection** - Groups of highly interconnected notes
- **Topic Clusters** - Notes grouped by content similarity
- **Temporal Clusters** - Notes created or modified around the same time
- **Hierarchical Clustering** - Nested groups and subgroups

## Search and Discovery

### Graph Search
Powerful search capabilities within the graph:

#### Search Types
- **Note Title** - Find notes by name
- **Content Search** - Search within note content
- **Tag Search** - Find notes with specific tags
- **Link Search** - Find notes linked to specific other notes

#### Search Results
- **Highlight Matches** - Matching nodes highlighted in graph
- **Filter View** - Show only matching nodes and their connections
- **Search Path** - Show shortest path between two notes
- **Related Suggestions** - Suggest related notes based on current selection

### Discovery Features
- **Orphaned Notes** - Find notes with no connections
- **Highly Connected Hubs** - Identify central, important notes
- **Recent Activity** - Highlight recently modified notes
- **Broken Links** - Find and fix broken wiki links

## Export and Sharing

### Export Options
Save your graph visualization in various formats:

#### Image Export
- **PNG** - High-resolution raster image
- **SVG** - Scalable vector graphics
- **PDF** - Print-ready document format
- **Canvas** - Interactive HTML5 canvas

#### Data Export
- **GraphML** - Standard graph data format
- **JSON** - Raw graph data for external tools
- **CSV** - Node and edge data in spreadsheet format
- **DOT** - Graphviz format for advanced visualization

### Sharing Features
- **Permalink** - Share specific graph view and settings
- **Embed Code** - Embed interactive graph in websites
- **Collaboration** - Share graph view with team members
- **Version History** - Track how graph evolves over time

## Performance and Optimization

### Rendering Performance
The graph view is optimized for large datasets:

#### WebGL Acceleration
- **GPU Rendering** - Utilize graphics card for smooth performance
- **Instanced Rendering** - Efficient drawing of many similar objects
- **Frustum Culling** - Only render visible portions of the graph
- **Level of Detail** - Adjust detail based on zoom level

#### Background Processing
- **Web Workers** - Move heavy calculations off main thread
- **Incremental Updates** - Update only changed portions of graph
- **Lazy Loading** - Load graph data only when needed
- **Caching** - Cache calculated layouts and renderings

### Large Graph Handling
Strategies for managing graphs with thousands of nodes:

#### Filtering and Simplification
- **Importance Filtering** - Show only most important nodes
- **Temporal Filtering** - Focus on recent activity
- **Depth Limiting** - Show only N degrees of separation
- **Clustering** - Group similar nodes together

#### Progressive Loading
- **Initial Overview** - Show simplified graph first
- **Detail on Demand** - Load full detail when exploring areas
- **Streaming Updates** - Continuously update graph as data changes
- **Background Preloading** - Prepare detailed views in advance

## Accessibility

### Keyboard Navigation
Full keyboard accessibility for the graph view:
- **Tab Navigation** - Move between graph elements
- **Arrow Keys** - Navigate between connected nodes
- **Enter** - Select or open focused node
- **Space** - Toggle node selection
- **Escape** - Clear selection or close graph

### Screen Reader Support
- **ARIA Labels** - Descriptive labels for all graph elements
- **Text Alternatives** - Text descriptions of visual relationships
- **Navigation Hints** - Spoken instructions for keyboard navigation
- **Content Summary** - High-level description of graph structure

### Visual Accessibility
- **High Contrast** - Support for high contrast display modes
- **Color Blindness** - Alternative visual cues beyond color
- **Zoom Support** - Works with browser zoom and magnification
- **Focus Indicators** - Clear visual focus indicators

## Advanced Features

### Custom Layouts
Alternative layout algorithms for different perspectives:

#### Layout Types
- **Hierarchical** - Tree-like structure showing information hierarchy
- **Circular** - Arrange nodes in concentric circles
- **Grid** - Organize nodes in a regular grid pattern
- **Radial** - Focus on one central node with others radiating out

#### Layout Configuration
- **Root Node Selection** - Choose starting point for hierarchical layouts
- **Grouping Criteria** - How to group nodes in structured layouts
- **Spacing Parameters** - Control distance and arrangement
- **Animation Settings** - Smooth transitions between layouts

### Graph Algorithms
Advanced analysis capabilities:

#### Path Finding
- **Shortest Path** - Find shortest connection between any two notes
- **All Paths** - Show all possible paths between notes
- **Path Constraints** - Find paths through specific types of connections
- **Path Recommendations** - Suggest optimal paths for exploration

#### Network Analysis
- **Connected Components** - Identify separate graph regions
- **Bridge Detection** - Find critical connections
- **Cut Vertices** - Identify nodes that disconnect the graph
- **Flow Analysis** - Understand information flow patterns

## Troubleshooting

### Common Issues

**Graph not displaying:**
- Check that notes exist in the workspace
- Verify graph view has permission to access files
- Look for JavaScript errors in browser console
- Try refreshing the graph view

**Performance problems:**
- Reduce the number of displayed nodes using filters
- Disable real-time updates for very large graphs
- Check available system memory
- Close other resource-intensive applications

**Layout issues:**
- Reset layout parameters to defaults
- Try different layout algorithms
- Check for isolated or disconnected notes
- Adjust repulsion and attraction forces

**Missing connections:**
- Verify wiki links are properly formatted
- Check that linked notes exist in workspace
- Look for case sensitivity issues in note names
- Refresh graph to update connections

### Performance Tips
1. **Use filters** - Display only relevant subsets of your graph
2. **Regular cleanup** - Remove or merge redundant notes
3. **Optimize note structure** - Create clear hierarchies and connections
4. **Monitor size** - Keep individual notes to reasonable sizes
5. **Update regularly** - Keep the graph view updated with recent changes

## Related Features

- **[Wiki Links](./wiki-links.md)** - Note linking system that powers the graph
- **[Search](./search.md)** - Advanced search capabilities
- **[File Management](./file-management.md)** - Workspace organization
- **[Command Palette](./command-palette.md)** - Quick access to graph commands

---

*For technical implementation details, see the [Graph API Documentation](../api/graph.md).*