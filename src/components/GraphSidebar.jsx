import React from 'react';
import { Network, Link, FileText, Tag, ChevronDown, ChevronRight, Search, Sliders, Palette, Filter, Zap, Play, Pause, Sparkles } from 'lucide-react';

/**
 * GraphSidebar - Obsidian-style graph customization panel
 *
 * Displays:
 * - Selected node details (when node is selected/hovered)
 * - Collapsible sections: Filters, Display, Forces
 * - Real-time customization controls
 */
export default function GraphSidebar({
  selectedNodes = [],
  hoveredNode = null,
  graphData = { nodes: [], links: [] },
  stats = {},
  onNodeClick = () => {},
  // Graph configuration
  config = {},
  onConfigChange = () => {},
  // Animation tour controls
  isAnimating = false,
  animationSpeed = 2000,
  onToggleAnimation = () => {},
  onAnimationSpeedChange = () => {}
}) {
  // Get the primary selected/hovered node
  const activeNode = hoveredNode || (selectedNodes.length > 0
    ? graphData.nodes.find(n => n.id === selectedNodes[0])
    : null);

  // Get connected nodes if we have an active node
  const connectedNodes = activeNode
    ? graphData.links
        .filter(link =>
          (link.source?.id || link.source) === activeNode.id ||
          (link.target?.id || link.target) === activeNode.id
        )
        .map(link => {
          const nodeId = (link.source?.id || link.source) === activeNode.id
            ? (link.target?.id || link.target)
            : (link.source?.id || link.source);
          return graphData.nodes.find(n => n.id === nodeId);
        })
        .filter(Boolean)
    : [];

  // Helper to toggle collapse state
  const toggleCollapse = (section) => {
    onConfigChange({
      ...config,
      [`collapse-${section}`]: !config[`collapse-${section}`]
    });
  };

  // Helper to update config value
  const updateConfig = (key, value) => {
    onConfigChange({
      ...config,
      [key]: value
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-app-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border">
        <h3 className="text-sm font-semibold text-app-text flex items-center gap-2">
          <Network className="w-4 h-4" />
          Graph Settings
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Node Details - Always visible if node selected */}
        {activeNode && (
          <div className="px-4 py-4 border-b border-app-border">
            <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2">
              {hoveredNode ? 'Hovered Node' : 'Selected Node'}
            </div>
            <div className="bg-app-bg rounded-lg p-3 border border-app-border">
              <div className="font-medium text-app-text mb-2 break-words">
                {activeNode.label || activeNode.title || activeNode.id}
              </div>
              <div className="flex items-center gap-2 text-xs text-app-muted mb-3">
                <div className={`w-2 h-2 rounded-full`}
                  style={{ backgroundColor: getNodeColor(activeNode) }}
                />
                <span className="capitalize">{activeNode.type || 'document'}</span>
              </div>

              {/* Node Stats */}
              <div className="space-y-2 text-xs">
                {activeNode.backlinkCount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-app-muted">Backlinks</span>
                    <span className="font-medium text-app-text">{activeNode.backlinkCount}</span>
                  </div>
                )}
                {activeNode.metadata?.wordCount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-app-muted">Words</span>
                    <span className="font-medium text-app-text">{activeNode.metadata.wordCount}</span>
                  </div>
                )}
                {activeNode.metadata?.tags && activeNode.metadata.tags.length > 0 && (
                  <div className="pt-2 border-t border-app-border">
                    <div className="text-app-muted mb-1">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {activeNode.metadata.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-app-accent/10 text-app-accent rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Connected Nodes */}
            {connectedNodes.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Link className="w-3 h-3" />
                  Connected ({connectedNodes.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {connectedNodes.slice(0, 10).map((node, i) => (
                    <button
                      key={i}
                      onClick={() => onNodeClick(node)}
                      className="w-full text-left px-3 py-2 bg-app-bg hover:bg-app-panel rounded border border-app-border hover:border-app-accent transition-all text-xs group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getNodeColor(node) }}
                        />
                        <span className="truncate text-app-text group-hover:text-app-accent">
                          {node.label || node.title || node.id}
                        </span>
                      </div>
                    </button>
                  ))}
                  {connectedNodes.length > 10 && (
                    <div className="text-xs text-app-muted text-center py-2">
                      +{connectedNodes.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FILTERS SECTION */}
        <div className="border-b border-app-border">
          <button
            onClick={() => toggleCollapse('filter')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-bg/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </div>
            {config['collapse-filter'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {!config['collapse-filter'] && (
            <div className="px-4 pb-4 space-y-3">
              {/* Search Filter */}
              <div>
                <label className="text-xs text-app-muted mb-1.5 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-app-muted" />
                  <input
                    type="text"
                    value={config.search || ''}
                    onChange={(e) => updateConfig('search', e.target.value)}
                    placeholder="Filter nodes..."
                    className="w-full pl-8 pr-3 py-2 bg-app-bg border border-app-border rounded text-xs text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={config.showTags ?? true}
                    onChange={(e) => updateConfig('showTags', e.target.checked)}
                    className="w-4 h-4 rounded border-app-border accent-app-accent"
                  />
                  <span>Show Tags</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={config.showAttachments ?? false}
                    onChange={(e) => updateConfig('showAttachments', e.target.checked)}
                    className="w-4 h-4 rounded border-app-border accent-app-accent"
                  />
                  <span>Show Attachments</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={config.hideUnresolved ?? false}
                    onChange={(e) => updateConfig('hideUnresolved', e.target.checked)}
                    className="w-4 h-4 rounded border-app-border accent-app-accent"
                  />
                  <span>Hide Unresolved (placeholders)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={config.showOrphans ?? true}
                    onChange={(e) => updateConfig('showOrphans', e.target.checked)}
                    className="w-4 h-4 rounded border-app-border accent-app-accent"
                  />
                  <span>Show Orphans (no connections)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* DISPLAY SECTION */}
        <div className="border-b border-app-border">
          <button
            onClick={() => toggleCollapse('display')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-bg/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <Palette className="w-4 h-4" />
              <span>Display</span>
            </div>
            {config['collapse-display'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {!config['collapse-display'] && (
            <div className="px-4 pb-4 space-y-4">
              {/* Show Arrows Checkbox */}
              <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer hover:text-app-accent transition-colors">
                <input
                  type="checkbox"
                  checked={config.showArrow ?? true}
                  onChange={(e) => updateConfig('showArrow', e.target.checked)}
                  className="w-4 h-4 rounded border-app-border accent-app-accent"
                />
                <span>Show Arrows</span>
              </label>

              {/* Text Fade Multiplier */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Text Fade</span>
                  <span className="text-app-text font-medium">{(config.textFadeMultiplier ?? 1.3).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={config.textFadeMultiplier ?? 1.3}
                  onChange={(e) => updateConfig('textFadeMultiplier', parseFloat(e.target.value))}
                  className="w-full accent-app-accent"
                />
              </div>

              {/* Node Size Multiplier */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Node Size</span>
                  <span className="text-app-text font-medium">{(config.nodeSizeMultiplier ?? 1.0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={config.nodeSizeMultiplier ?? 1.0}
                  onChange={(e) => updateConfig('nodeSizeMultiplier', parseFloat(e.target.value))}
                  className="w-full accent-app-accent"
                />
              </div>

              {/* Line Size Multiplier */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Line Size</span>
                  <span className="text-app-text font-medium">{(config.lineSizeMultiplier ?? 1.0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={config.lineSizeMultiplier ?? 1.0}
                  onChange={(e) => updateConfig('lineSizeMultiplier', parseFloat(e.target.value))}
                  className="w-full accent-app-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* FORCES SECTION */}
        <div className="border-b border-app-border">
          <button
            onClick={() => toggleCollapse('forces')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-bg/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <Zap className="w-4 h-4" />
              <span>Forces</span>
            </div>
            {config['collapse-forces'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {!config['collapse-forces'] && (
            <div className="px-4 pb-4 space-y-4">
              {/* Center Strength */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Center Strength</span>
                  <span className="text-app-text font-medium">{(config.centerStrength ?? 0.3).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.centerStrength ?? 0.3}
                  onChange={(e) => updateConfig('centerStrength', parseFloat(e.target.value))}
                  className="w-full accent-app-accent"
                />
                <div className="text-xs text-app-muted mt-1">Pull toward center (lower = more spread)</div>
              </div>

              {/* Repel Strength */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Repel Strength</span>
                  <span className="text-app-text font-medium">{(config.repelStrength ?? 15).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={config.repelStrength ?? 15}
                  onChange={(e) => updateConfig('repelStrength', parseFloat(e.target.value))}
                  className="w-full accent-app-accent"
                />
                <div className="text-xs text-app-muted mt-1">Push nodes apart (higher = more separation)</div>
              </div>

              {/* Link Strength */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Link Strength</span>
                  <span className="text-app-text font-medium">{(config.linkStrength ?? 0.5).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.linkStrength ?? 0.5}
                  onChange={(e) => updateConfig('linkStrength', parseFloat(e.target.value))}
                  className="w-full accent-app-accent"
                />
                <div className="text-xs text-app-muted mt-1">Connection stiffness (lower = more flexible)</div>
              </div>

              {/* Link Distance */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Link Distance</span>
                  <span className="text-app-text font-medium">{Math.round(config.linkDistance ?? 250)}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={config.linkDistance ?? 250}
                  onChange={(e) => updateConfig('linkDistance', parseInt(e.target.value))}
                  className="w-full accent-app-accent"
                />
                <div className="text-xs text-app-muted mt-1">Target spacing between connected nodes</div>
              </div>
            </div>
          )}
        </div>

        {/* COLOR GROUPS SECTION */}
        <div className="border-b border-app-border">
          <button
            onClick={() => toggleCollapse('groups')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-bg/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <Palette className="w-4 h-4" />
              <span>Color Groups</span>
            </div>
            {config['collapse-groups'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {!config['collapse-groups'] && (
            <div className="px-4 pb-4 space-y-4">
              {/* Color Scheme Selector */}
              <div>
                <label className="text-xs text-app-muted mb-1.5 block">Color Scheme</label>
                <select
                  value={config.colorScheme || 'type'}
                  onChange={(e) => updateConfig('colorScheme', e.target.value)}
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-xs text-app-text focus:outline-none focus:border-app-accent"
                >
                  <option value="type">By Type (document/tag/folder)</option>
                  <option value="folder">By Folder Depth</option>
                  <option value="tag">By Primary Tag</option>
                  <option value="creation-date">By Creation Date</option>
                  <option value="modification-date">By Modification Date</option>
                  <option value="custom">Custom Groups</option>
                </select>
                <div className="text-xs text-app-muted mt-1.5">
                  {config.colorScheme === 'type' && 'Colors nodes by their type (document, placeholder, tag, etc.)'}
                  {config.colorScheme === 'folder' && 'Colors nodes by folder depth in the file tree'}
                  {config.colorScheme === 'tag' && 'Colors nodes by their primary tag'}
                  {config.colorScheme === 'creation-date' && 'Colors nodes by creation date (recent to old)'}
                  {config.colorScheme === 'modification-date' && 'Colors nodes by modification date'}
                  {config.colorScheme === 'custom' && 'Use custom color groups defined below'}
                </div>
              </div>

              {/* Custom Color Groups (only show if custom scheme selected) */}
              {config.colorScheme === 'custom' && (
                <div className="space-y-2">
                  <div className="text-xs text-app-muted mb-2">Custom Groups</div>

                  {config.colorGroups && config.colorGroups.length > 0 ? (
                    <div className="space-y-2">
                      {config.colorGroups.map((group, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-app-bg rounded border border-app-border">
                          <input
                            type="color"
                            value={group.color}
                            onChange={(e) => {
                              const newGroups = [...(config.colorGroups || [])];
                              newGroups[index].color = e.target.value;
                              updateConfig('colorGroups', newGroups);
                            }}
                            className="w-8 h-8 rounded border border-app-border cursor-pointer"
                          />
                          <div className="flex-1">
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => {
                                const newGroups = [...(config.colorGroups || [])];
                                newGroups[index].name = e.target.value;
                                updateConfig('colorGroups', newGroups);
                              }}
                              placeholder="Group name"
                              className="w-full px-2 py-1 bg-app-panel border border-app-border rounded text-xs text-app-text focus:outline-none focus:border-app-accent"
                            />
                            <div className="text-xs text-app-muted mt-1">
                              {(group.nodeIds || []).length} nodes
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const newGroups = config.colorGroups.filter((_, i) => i !== index);
                              updateConfig('colorGroups', newGroups);
                            }}
                            className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-app-muted text-center py-4 bg-app-bg rounded border border-app-border border-dashed">
                      No custom groups yet
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const newGroup = {
                        name: `Group ${(config.colorGroups || []).length + 1}`,
                        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                        nodeIds: []
                      };
                      updateConfig('colorGroups', [...(config.colorGroups || []), newGroup]);
                    }}
                    className="w-full px-3 py-2 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent rounded text-xs font-medium transition-colors"
                  >
                    + Add Color Group
                  </button>

                  <div className="text-xs text-app-muted mt-2 p-2 bg-app-bg rounded border border-app-border">
                    💡 Tip: Select nodes in the graph, then drag them into a color group to assign colors
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ANIMATION CONTROLS SECTION */}
        <div className="border-b border-app-border">
          <button
            onClick={() => toggleCollapse('animation')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-bg/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <Sparkles className="w-4 h-4" />
              <span>Animation Tour</span>
            </div>
            {config['collapse-animation'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {!config['collapse-animation'] && (
            <div className="px-4 pb-4 space-y-4">
              {/* Play/Pause Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleAnimation}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isAnimating
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30'
                      : 'bg-app-accent/10 hover:bg-app-accent/20 text-app-accent border border-app-accent/30'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {isAnimating ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Stop Tour</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Start Tour</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Speed Control */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-app-muted">Animation Speed</span>
                  <span className="text-app-text font-medium">
                    {animationSpeed / 1000}s per node
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="100"
                  value={animationSpeed}
                  onChange={(e) => onAnimationSpeedChange(parseInt(e.target.value))}
                  className="w-full accent-app-accent"
                />
                <div className="text-xs text-app-muted mt-1">
                  How long to focus on each node (faster ← → slower)
                </div>
              </div>

              {/* Info */}
              <div className="text-xs text-app-muted p-3 bg-app-bg rounded border border-app-border">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-app-accent" />
                  <div>
                    <div className="font-medium text-app-text mb-1">Auto-tour your knowledge graph</div>
                    <div>
                      Automatically cycles through all visible nodes, focusing and zooming on each one.
                      Perfect for exploring your knowledge base or presentations.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STATISTICS SECTION */}
        <div className="px-4 py-4">
          <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-3">
            Statistics
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<FileText className="w-4 h-4" />}
              label="Nodes"
              value={stats.nodeCount || graphData.nodes.length}
            />
            <StatCard
              icon={<Link className="w-4 h-4" />}
              label="Links"
              value={stats.linkCount || graphData.links.length}
            />
            <StatCard
              icon={<Network className="w-4 h-4" />}
              label="WikiLinks"
              value={stats.wikiLinkCount || 0}
            />
            <StatCard
              icon={<Tag className="w-4 h-4" />}
              label="Placeholders"
              value={stats.placeholderCount || 0}
            />
          </div>

          {/* Performance Info */}
          {stats.fps && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2">
                Performance
              </div>
              <div className="bg-app-bg rounded-lg p-3 border border-app-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-app-muted">FPS</span>
                  <span className={`font-medium ${
                    stats.fps >= 50 ? 'text-green-500' :
                    stats.fps >= 30 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {Math.round(stats.fps)}
                  </span>
                </div>
                {stats.renderTime !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-app-muted">Render Time</span>
                    <span className="font-medium text-app-text">{stats.renderTime}ms</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for stat cards
function StatCard({ icon, label, value }) {
  return (
    <div className="bg-app-bg rounded-lg p-3 border border-app-border">
      <div className="flex items-center gap-2 text-app-muted mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-bold text-app-text">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

// Node color helper (matches ProfessionalGraphView)
function getNodeColor(node) {
  const colorMap = {
    document: '#10b981',
    placeholder: '#6b7280',
    tag: '#ef4444',
    folder: '#f59e0b',
    attachment: '#8b5cf6'
  };
  return colorMap[node.type] || '#6366f1';
}
