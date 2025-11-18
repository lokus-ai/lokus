import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BacklinkManager } from '../core/links/backlink-manager.js';
import { MentionDetector } from '../core/links/mention-detector.js';
import blockBacklinkManager from '../core/links/block-backlink-manager.js';
import { Search, ChevronDown, ChevronRight, Link2, FileText, Hash } from 'lucide-react';

/**
 * BacklinksPanel - Show all notes linking to current note
 */
export default function BacklinksPanel({
  graphData,
  currentFile,
  onOpenFile
}) {
  const [backlinks, setBacklinks] = useState([]);
  const [unlinkedMentions, setUnlinkedMentions] = useState([]);
  const [blockBacklinks, setBlockBacklinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedExpanded, setLinkedExpanded] = useState(true);
  const [blockBacklinksExpanded, setBlockBacklinksExpanded] = useState(false);
  const [unlinkedExpanded, setUnlinkedExpanded] = useState(false);
  const [expandedSources, setExpandedSources] = useState(new Set());

  const backlinkManagerRef = useRef(null);
  const mentionDetectorRef = useRef(null);

  // Initialize managers
  useEffect(() => {
    if (!graphData) return;

    try {
      backlinkManagerRef.current = new BacklinkManager(graphData);
      mentionDetectorRef.current = new MentionDetector(graphData);
    } catch (error) {
      console.error('Error initializing backlinks panel:', error);
    }

    return () => {
      if (backlinkManagerRef.current) {
        backlinkManagerRef.current.destroy();
      }
      if (mentionDetectorRef.current) {
        mentionDetectorRef.current.destroy();
      }
    };
  }, [graphData]);

  // Get current node ID from file path
  const currentNodeId = useMemo(() => {
    if (!currentFile || !graphData || !graphData.nodes) return null;

    // If graphData has documentNodes (GraphData), use it
    if (graphData.documentNodes) {
      for (const [docId, nodeId] of graphData.documentNodes.entries()) {
        if (docId === currentFile) {
          return nodeId;
        }
      }
    }

    // Otherwise search nodes by path (GraphDatabase compatibility)
    for (const [nodeId, node] of graphData.nodes.entries()) {
      if (node.path === currentFile || node.documentId === currentFile) {
        return nodeId;
      }
    }

    return null;
  }, [currentFile, graphData]);

  // Update backlinks when current file changes
  useEffect(() => {
    if (!currentNodeId || !backlinkManagerRef.current || !mentionDetectorRef.current) {
      setBacklinks([]);
      setUnlinkedMentions([]);
      setBlockBacklinks([]);
      return;
    }

    try {
      const links = backlinkManagerRef.current.getBacklinks(currentNodeId);
      setBacklinks(links);

      const mentions = mentionDetectorRef.current.getUnlinkedMentions(currentNodeId);
      setUnlinkedMentions(mentions);

      // Get block backlinks
      if (currentFile) {
        const fileName = currentFile.split('/').pop()?.replace('.md', '') || ''

        // Index if not already indexed
        if (!blockBacklinkManager.indexed && graphData?.nodes) {
          const fileIndex = graphData.nodes.map(node => ({ path: node.id }))
          blockBacklinkManager.indexBlockLinks(fileIndex).catch(err => {
            console.error('[BacklinksPanel] Error indexing block links:', err)
          })
        }

        const blockLinks = blockBacklinkManager.getFileBlockBacklinks(fileName)
        setBlockBacklinks(blockLinks)
      }
    } catch (error) {
      console.error('Error updating backlinks:', error);
    }
  }, [currentNodeId, currentFile, graphData]);

  // Filter backlinks by search query
  const filteredBacklinks = useMemo(() => {
    if (!searchQuery.trim()) return backlinks;

    const query = searchQuery.toLowerCase();
    return backlinks.filter(backlink => {
      return (
        backlink.sourceTitle.toLowerCase().includes(query) ||
        backlink.context?.full?.toLowerCase().includes(query)
      );
    });
  }, [backlinks, searchQuery]);

  // Filter unlinked mentions by search query
  const filteredMentions = useMemo(() => {
    if (!searchQuery.trim()) return unlinkedMentions;

    const query = searchQuery.toLowerCase();
    return unlinkedMentions.filter(mention => {
      return (
        mention.sourceTitle.toLowerCase().includes(query) ||
        mention.context?.full?.toLowerCase().includes(query)
      );
    });
  }, [unlinkedMentions, searchQuery]);

  // Group backlinks by source
  const groupedBacklinks = useMemo(() => {
    const groups = new Map();

    for (const backlink of filteredBacklinks) {
      const sourceId = backlink.sourceNodeId;
      if (!groups.has(sourceId)) {
        groups.set(sourceId, {
          sourceId,
          sourceTitle: backlink.sourceTitle,
          backlinks: []
        });
      }
      groups.get(sourceId).backlinks.push(backlink);
    }

    return Array.from(groups.values());
  }, [filteredBacklinks]);

  // Group unlinked mentions by source
  const groupedMentions = useMemo(() => {
    const groups = new Map();

    for (const mention of filteredMentions) {
      const sourceId = mention.sourceNodeId;
      if (!groups.has(sourceId)) {
        groups.set(sourceId, {
          sourceId,
          sourceTitle: mention.sourceTitle,
          mentions: []
        });
      }
      groups.get(sourceId).mentions.push(mention);
    }

    return Array.from(groups.values());
  }, [filteredMentions]);

  // Toggle source expansion
  const toggleSource = useCallback((sourceId) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // Handle click on backlink
  const handleBacklinkClick = useCallback((backlink) => {
    if (!onOpenFile || !graphData) return;

    const sourceNode = graphData.nodes.get(backlink.sourceNodeId);
    if (sourceNode && sourceNode.documentId) {
      onOpenFile(sourceNode.documentId);
    }
  }, [onOpenFile, graphData]);

  // Handle click on mention
  const handleMentionClick = useCallback((mention) => {
    if (!onOpenFile || !graphData) return;

    const sourceNode = graphData.nodes.get(mention.sourceNodeId);
    if (sourceNode && sourceNode.documentId) {
      onOpenFile(sourceNode.documentId);
    }
  }, [onOpenFile, graphData]);

  // Render context snippet
  const renderContext = useCallback((context) => {
    if (!context || !context.before || !context.after) {
      return <span style={{ color: 'var(--muted)', fontSize: '12px' }}>No context available</span>;
    }

    return (
      <div style={{
        fontSize: '12px',
        color: 'var(--muted)',
        lineHeight: '1.5',
        marginTop: '4px',
        wordBreak: 'break-word'
      }}>
        <span>{context.before}</span>
        <span style={{
          fontWeight: '600',
          color: 'var(--accent)',
          backgroundColor: 'var(--accent-bg)',
          padding: '1px 3px',
          borderRadius: '2px'
        }}>
          {context.match}
        </span>
        <span>{context.after}</span>
      </div>
    );
  }, []);

  // Render backlink group
  const renderBacklinkGroup = useCallback((group) => {
    const isExpanded = expandedSources.has(group.sourceId);

    return (
      <div key={group.sourceId} style={{ marginBottom: '8px' }}>
        <div
          onClick={() => toggleSource(group.sourceId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {isExpanded ? (
            <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
          )}
          <FileText size={14} style={{ color: 'var(--accent)' }} />
          <span style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: '500',
            color: 'var(--text)'
          }}>
            {group.sourceTitle}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--muted)',
            backgroundColor: 'var(--panel)',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            {group.backlinks.length}
          </span>
        </div>

        {isExpanded && (
          <div style={{ marginLeft: '20px', marginTop: '4px' }}>
            {group.backlinks.map((backlink, idx) => (
              <div
                key={`${backlink.sourceNodeId}-${idx}`}
                onClick={() => handleBacklinkClick(backlink)}
                style={{
                  padding: '8px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  borderLeft: '2px solid var(--accent)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {renderContext(backlink.context)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [expandedSources, toggleSource, handleBacklinkClick, renderContext]);

  // Render mention group
  const renderMentionGroup = useCallback((group) => {
    const isExpanded = expandedSources.has(`mention-${group.sourceId}`);

    return (
      <div key={`mention-${group.sourceId}`} style={{ marginBottom: '8px' }}>
        <div
          onClick={() => toggleSource(`mention-${group.sourceId}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {isExpanded ? (
            <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
          )}
          <FileText size={14} style={{ color: 'var(--muted)' }} />
          <span style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: '500',
            color: 'var(--text)'
          }}>
            {group.sourceTitle}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--muted)',
            backgroundColor: 'var(--panel)',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            {group.mentions.length}
          </span>
        </div>

        {isExpanded && (
          <div style={{ marginLeft: '20px', marginTop: '4px' }}>
            {group.mentions.map((mention, idx) => (
              <div
                key={`${mention.position}-${idx}`}
                onClick={() => handleMentionClick(mention)}
                style={{
                  padding: '8px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  borderLeft: '2px solid var(--muted)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {renderContext(mention.context)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [expandedSources, toggleSource, handleMentionClick, renderContext]);

  if (!graphData) {
    return (
      <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '13px' }}>
        Graph data not available
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '13px' }}>
        No file selected
      </div>
    );
  }

  const totalBacklinks = filteredBacklinks.length;
  const totalMentions = filteredMentions.length;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 8px 8px 8px',
        fontWeight: '600',
        fontSize: '12px',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        letterSpacing: '0.5px',
        borderBottom: '1px solid var(--border)'
      }}>
        Backlinks
      </div>

      {/* Search */}
      <div style={{ padding: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 8px',
          backgroundColor: 'var(--panel)',
          borderRadius: '4px',
          border: '1px solid var(--border)'
        }}>
          <Search size={14} style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Filter backlinks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '8px'
      }}>
        {/* Linked Mentions Section */}
        <div style={{ marginBottom: '16px' }}>
          <div
            onClick={() => setLinkedExpanded(!linkedExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              borderRadius: '4px',
              marginBottom: '8px',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {linkedExpanded ? (
              <ChevronDown size={16} style={{ color: 'var(--text)' }} />
            ) : (
              <ChevronRight size={16} style={{ color: 'var(--text)' }} />
            )}
            <Link2 size={16} style={{ color: 'var(--accent)' }} />
            <span style={{
              flex: 1,
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)'
            }}>
              Linked mentions
            </span>
            <span style={{
              fontSize: '12px',
              color: 'var(--muted)',
              backgroundColor: 'var(--panel)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: '500'
            }}>
              {totalBacklinks}
            </span>
          </div>

          {linkedExpanded && (
            <div>
              {groupedBacklinks.length === 0 ? (
                <div style={{
                  padding: '16px',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  No backlinks found
                </div>
              ) : (
                groupedBacklinks.map(renderBacklinkGroup)
              )}
            </div>
          )}
        </div>

        {/* Block Backlinks Section */}
        <div>
          <div
            onClick={() => setBlockBacklinksExpanded(!blockBacklinksExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              borderRadius: '4px',
              marginBottom: '8px',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {blockBacklinksExpanded ? (
              <ChevronDown size={16} style={{ color: 'var(--text)' }} />
            ) : (
              <ChevronRight size={16} style={{ color: 'var(--text)' }} />
            )}
            <Hash size={16} style={{ color: 'var(--accent)' }} />
            <span style={{
              flex: 1,
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)'
            }}>
              Block references
            </span>
            <span style={{
              fontSize: '12px',
              color: 'var(--muted)',
              backgroundColor: 'var(--panel)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: '500'
            }}>
              {blockBacklinks.length}
            </span>
          </div>

          {blockBacklinksExpanded && (
            <div>
              {blockBacklinks.length === 0 ? (
                <div style={{
                  padding: '16px',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  No block references found
                </div>
              ) : (
                blockBacklinks.map((link, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenFile(link.sourceFile)}
                    style={{
                      padding: '8px 12px',
                      marginBottom: '4px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      fontSize: '13px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px'
                    }}>
                      <FileText size={14} style={{ color: 'var(--muted)' }} />
                      <span style={{ fontWeight: '500', color: 'var(--text)' }}>
                        {link.sourceFile.split('/').pop()?.replace('.md', '')}
                      </span>
                      {link.isEmbed && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                          fontWeight: '600'
                        }}>
                          EMBED
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      paddingLeft: '20px'
                    }}>
                      Line {link.lineNumber}: {link.context.before}
                      <span style={{ color: 'var(--accent)', fontWeight: '600' }}>
                        [[{link.targetFile}^{link.blockId}]]
                      </span>
                      {link.context.after}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Unlinked Mentions Section */}
        <div>
          <div
            onClick={() => setUnlinkedExpanded(!unlinkedExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              borderRadius: '4px',
              marginBottom: '8px',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--panel)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {unlinkedExpanded ? (
              <ChevronDown size={16} style={{ color: 'var(--text)' }} />
            ) : (
              <ChevronRight size={16} style={{ color: 'var(--text)' }} />
            )}
            <FileText size={16} style={{ color: 'var(--muted)' }} />
            <span style={{
              flex: 1,
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)'
            }}>
              Unlinked mentions
            </span>
            <span style={{
              fontSize: '12px',
              color: 'var(--muted)',
              backgroundColor: 'var(--panel)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: '500'
            }}>
              {totalMentions}
            </span>
          </div>

          {unlinkedExpanded && (
            <div>
              {groupedMentions.length === 0 ? (
                <div style={{
                  padding: '16px',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  No unlinked mentions found
                </div>
              ) : (
                groupedMentions.map(renderMentionGroup)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
