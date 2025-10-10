import React from 'react';
import { Network, Link, FileText, Tag, Clock } from 'lucide-react';

/**
 * GraphSidebar - Shows graph information in the right sidebar
 *
 * Displays:
 * - Selected node details
 * - Graph statistics
 * - Connected nodes
 */
export default function GraphSidebar({
  selectedNodes = [],
  hoveredNode = null,
  graphData = { nodes: [], links: [] },
  stats = {},
  onNodeClick = () => {}
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border">
        <h3 className="text-sm font-semibold text-app-text flex items-center gap-2">
          <Network className="w-4 h-4" />
          Graph View
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Active Node Details */}
        {activeNode ? (
          <div className="space-y-4">
            <div>
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
            </div>

            {/* Connected Nodes */}
            {connectedNodes.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Link className="w-3 h-3" />
                  Connected ({connectedNodes.length})
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {connectedNodes.slice(0, 20).map((node, i) => (
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
                  {connectedNodes.length > 20 && (
                    <div className="text-xs text-app-muted text-center py-2">
                      +{connectedNodes.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-app-muted text-sm">
            <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click or hover a node to see details</p>
          </div>
        )}

        {/* Graph Statistics */}
        <div>
          <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2">
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
        </div>

        {/* Performance Info */}
        {stats.fps && (
          <div>
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

        {/* Quick Tips */}
        <div>
          <div className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2">
            Quick Tips
          </div>
          <div className="bg-app-bg rounded-lg p-3 border border-app-border space-y-2 text-xs text-app-muted">
            <div>• Click nodes to select and view details</div>
            <div>• Drag nodes to reposition them</div>
            <div>• Scroll to zoom in/out</div>
            <div>• Use controls panel for view modes</div>
          </div>
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
