import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BacklinkManager } from '../core/links/backlink-manager.js';
import { MentionDetector } from '../core/links/mention-detector.js';
import blockBacklinkManager from '../core/links/block-backlink-manager.js';
import { Search, ChevronDown, ChevronRight, Link2, FileText, Hash } from 'lucide-react';
import { blockIndexClient } from '../core/blocks/BlockIndexClient.js';
import { useFeatureFlags } from '../contexts/RemoteConfigContext.jsx';

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
  const [sqliteBlockRefsExpanded, setSqliteBlockRefsExpanded] = useState(true);
  const [unlinkedExpanded, setUnlinkedExpanded] = useState(false);
  const [expandedSources, setExpandedSources] = useState(new Set());

  // SQLite-powered block refs state
  const [sqliteBlockRefs, setSqliteBlockRefs] = useState([]);
  const [sqliteLoading, setSqliteLoading] = useState(false);

  const backlinkManagerRef = useRef(null);
  const mentionDetectorRef = useRef(null);

  const featureFlags = useFeatureFlags();
  const blockIndexEnabled = featureFlags?.block_index_v1 === true;

  // Initialize managers
  useEffect(() => {
    if (!graphData) return;

    try {
      backlinkManagerRef.current = new BacklinkManager(graphData);
      mentionDetectorRef.current = new MentionDetector(graphData);
    } catch (err) {
      console.error('BacklinksPanel: Failed to initialize link managers', err);
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

    // Search nodes by path
    for (const [nodeId, node] of graphData.nodes.entries()) {
      if (node.path === currentFile) {
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
          const fileIndex = Array.from(graphData.nodes.values()).map(node => ({
            path: node.path,
            title: node.title
          }))
          blockBacklinkManager.indexBlockLinks(fileIndex).catch(err => {
            console.error('BacklinksPanel: Failed to index block links', err);
          })
        }

        const blockLinks = blockBacklinkManager.getFileBlockBacklinks(fileName)
        setBlockBacklinks(blockLinks)
      }
    } catch (err) {
      console.error('BacklinksPanel: Failed to update backlinks', err);
    }
  }, [currentNodeId, currentFile, graphData]);

  // ── SQLite block refs (block_index_v1) ───────────────────────────────────

  /**
   * Load block-level backlinks from the SQLite index for the current file.
   * Steps:
   *   1. Get all blocks belonging to this file via getFileBlocks().
   *   2. For each block, call getBacklinks(blockId) to find incoming refs.
   *   3. Flatten + group by source file for display.
   */
  const loadSqliteBlockRefs = useCallback(async () => {
    if (!blockIndexEnabled || !currentFile) {
      setSqliteBlockRefs([]);
      return;
    }

    setSqliteLoading(true);
    try {
      // 1. Get all blocks in the current file
      const fileBlocks = await blockIndexClient.getFileBlocks(currentFile);
      if (!Array.isArray(fileBlocks) || fileBlocks.length === 0) {
        setSqliteBlockRefs([]);
        setSqliteLoading(false);
        return;
      }

      // 2. For each block, fetch incoming backlinks
      const allRefs = [];
      await Promise.all(
        fileBlocks.map(async (block) => {
          try {
            const refs = await blockIndexClient.getBacklinks(block.id);
            if (Array.isArray(refs)) {
              for (const ref of refs) {
                allRefs.push({
                  ...ref,
                  // Attach the target block's preview so we know what was linked
                  targetBlockPreview: block.textPreview || block.id,
                  targetBlockId: block.id,
                  targetBlockType: block.nodeType,
                });
              }
            }
          } catch (_) {
            // Individual block backlink failure is non-fatal
          }
        })
      );

      // 3. Group by source file
      const byFile = new Map();
      for (const ref of allRefs) {
        const sourceFile = ref.sourceFile || 'Unknown file';
        if (!byFile.has(sourceFile)) {
          byFile.set(sourceFile, []);
        }
        byFile.get(sourceFile).push(ref);
      }

      // Convert to sorted array (most refs first)
      const grouped = Array.from(byFile.entries())
        .map(([sourceFile, refs]) => ({ sourceFile, refs }))
        .sort((a, b) => b.refs.length - a.refs.length);

      setSqliteBlockRefs(grouped);
    } catch (err) {
      console.error('BacklinksPanel: Failed to load SQLite block refs', err);
      setSqliteBlockRefs([]);
    } finally {
      setSqliteLoading(false);
    }
  }, [blockIndexEnabled, currentFile]);

  // Load on mount and when currentFile changes
  useEffect(() => {
    if (!blockIndexEnabled) return;
    loadSqliteBlockRefs();
  }, [blockIndexEnabled, loadSqliteBlockRefs]);

  // Subscribe to index updates for live refresh
  useEffect(() => {
    if (!blockIndexEnabled) return;

    const unsubscribe = blockIndexClient.subscribe((payload) => {
      // Re-query if the updated file is either the current file (its blocks changed)
      // or any source file that may link to this one.
      if (!payload) {
        loadSqliteBlockRefs();
        return;
      }
      const { file, added_refs, removed_refs } = payload;
      const isRelevant =
        file === currentFile ||
        (Array.isArray(added_refs) && added_refs.length > 0) ||
        (Array.isArray(removed_refs) && removed_refs.length > 0);
      if (isRelevant) {
        loadSqliteBlockRefs();
      }
    });

    return unsubscribe;
  }, [blockIndexEnabled, currentFile, loadSqliteBlockRefs]);

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

  // Filter SQLite block refs by search query
  const filteredSqliteBlockRefs = useMemo(() => {
    if (!searchQuery.trim()) return sqliteBlockRefs;

    const query = searchQuery.toLowerCase();
    return sqliteBlockRefs
      .map(group => ({
        ...group,
        refs: group.refs.filter(ref =>
          (ref.sourceFile || '').toLowerCase().includes(query) ||
          (ref.sourceBlockId || '').toLowerCase().includes(query) ||
          (ref.targetBlockPreview || '').toLowerCase().includes(query)
        ),
      }))
      .filter(group => group.refs.length > 0);
  }, [sqliteBlockRefs, searchQuery]);

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
    if (sourceNode && sourceNode.path) {
      onOpenFile({ path: sourceNode.path, name: sourceNode.title });
    }
  }, [onOpenFile, graphData]);

  // Handle click on mention
  const handleMentionClick = useCallback((mention) => {
    if (!onOpenFile || !graphData) return;

    const sourceNode = graphData.nodes.get(mention.sourceNodeId);
    if (sourceNode && sourceNode.path) {
      onOpenFile({ path: sourceNode.path, name: sourceNode.title });
    }
  }, [onOpenFile, graphData]);

  // Handle click on SQLite block ref — open the source file
  const handleSqliteRefClick = useCallback((sourceFile) => {
    if (!onOpenFile) return;
    const fileName = sourceFile.split('/').pop()?.replace('.md', '') || sourceFile;
    onOpenFile({ path: sourceFile, name: fileName });
  }, [onOpenFile]);

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

  // Render a single SQLite block ref row
  const renderSqliteRefRow = useCallback((ref, idx) => {
    const sourceFileName = (ref.sourceFile || '').split('/').pop()?.replace('.md', '') || ref.sourceFile || 'Unknown';
    const kindLabel = ref.kind === 'embed' ? 'EMBED' : null;

    return (
      <div
        key={`sqlite-ref-${ref.sourceBlockId || idx}-${idx}`}
        onClick={() => handleSqliteRefClick(ref.sourceFile)}
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
        {/* Source block info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '3px'
        }}>
          <Hash size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <code style={{
            fontSize: '11px',
            color: 'var(--muted)',
            backgroundColor: 'var(--panel)',
            padding: '1px 4px',
            borderRadius: '3px',
            fontFamily: 'monospace'
          }}>
            {ref.sourceBlockId || 'unknown'}
          </code>
          {kindLabel && (
            <span style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              fontWeight: '600',
              marginLeft: '2px'
            }}>
              {kindLabel}
            </span>
          )}
        </div>

        {/* Target block preview — what this block links to */}
        {ref.targetBlockPreview && (
          <div style={{
            fontSize: '12px',
            color: 'var(--muted)',
            paddingLeft: '17px',
            lineHeight: '1.4',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            <span style={{ color: 'var(--muted)' }}>refs: </span>
            <span style={{ color: 'var(--accent)', fontWeight: '500' }}>
              {ref.targetBlockPreview.length > 60
                ? ref.targetBlockPreview.slice(0, 60) + '...'
                : ref.targetBlockPreview}
            </span>
          </div>
        )}
      </div>
    );
  }, [handleSqliteRefClick]);

  // Render a SQLite block refs group (grouped by source file)
  const renderSqliteRefGroup = useCallback((group) => {
    const groupKey = `sqlite-file-${group.sourceFile}`;
    const isExpanded = expandedSources.has(groupKey);
    const sourceFileName = group.sourceFile.split('/').pop()?.replace('.md', '') || group.sourceFile;

    return (
      <div key={groupKey} style={{ marginBottom: '8px' }}>
        <div
          onClick={() => toggleSource(groupKey)}
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
          <span
            style={{
              flex: 1,
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text)'
            }}
            title={group.sourceFile}
          >
            {sourceFileName}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--muted)',
            backgroundColor: 'var(--panel)',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            {group.refs.length}
          </span>
        </div>

        {isExpanded && (
          <div style={{ marginLeft: '20px', marginTop: '4px' }}>
            {group.refs.map((ref, idx) => renderSqliteRefRow(ref, idx))}
          </div>
        )}
      </div>
    );
  }, [expandedSources, toggleSource, renderSqliteRefRow]);

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
  const totalSqliteRefs = filteredSqliteBlockRefs.reduce((sum, g) => sum + g.refs.length, 0);

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

        {/* Block Backlinks Section (legacy regex-based) */}
        <div style={{ marginBottom: '16px' }}>
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

        {/* SQLite Block Refs Section (block_index_v1) */}
        {blockIndexEnabled && (
          <div style={{ marginBottom: '16px' }}>
            <div
              onClick={() => setSqliteBlockRefsExpanded(!sqliteBlockRefsExpanded)}
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
              {sqliteBlockRefsExpanded ? (
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
                Block refs
              </span>
              {/* Badge showing count or loading state */}
              {sqliteLoading ? (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  padding: '2px 8px'
                }}>
                  ...
                </span>
              ) : (
                <span style={{
                  fontSize: '12px',
                  color: 'var(--muted)',
                  backgroundColor: 'var(--panel)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  {totalSqliteRefs}
                </span>
              )}
              {/* "indexed" label to distinguish from legacy regex results */}
              <span style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                fontWeight: '600',
                marginLeft: '4px',
                opacity: 0.8
              }}>
                idx
              </span>
            </div>

            {sqliteBlockRefsExpanded && (
              <div>
                {sqliteLoading ? (
                  <div style={{
                    padding: '16px',
                    color: 'var(--muted)',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    Loading indexed refs...
                  </div>
                ) : filteredSqliteBlockRefs.length === 0 ? (
                  <div style={{
                    padding: '16px',
                    color: 'var(--muted)',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    No indexed block refs found
                  </div>
                ) : (
                  filteredSqliteBlockRefs.map(renderSqliteRefGroup)
                )}
              </div>
            )}
          </div>
        )}

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
