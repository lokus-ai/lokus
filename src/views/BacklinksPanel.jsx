import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import blockBacklinkManager from '../core/links/block-backlink-manager.js';
import { useGraphStore } from '../core/graph2/graphStore.js';
import { Search, ChevronDown, ChevronRight, Link2, FileText, Hash } from 'lucide-react';

const WIKILINK_RE = /\[\[[^\]\n]*\]\]/g;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Context snippet around a match — 50 chars each side, trimmed at word edges. */
function snippetAt(line, start, length) {
  const beforeStart = Math.max(0, start - 50);
  const afterEnd = Math.min(line.length, start + length + 50);

  let before = line.slice(beforeStart, start);
  let after = line.slice(start + length, afterEnd);

  if (beforeStart > 0) {
    const firstSpace = before.indexOf(' ');
    if (firstSpace !== -1) before = '...' + before.slice(firstSpace + 1);
  }
  if (afterEnd < line.length) {
    const lastSpace = after.lastIndexOf(' ');
    if (lastSpace !== -1) after = after.slice(0, lastSpace) + '...';
  }

  before = before.replace(/\s+/g, ' ').trim();
  after = after.replace(/\s+/g, ' ').trim();
  const match = line.slice(start, start + length);

  return { before, match, after, full: `${before}${match}${after}` };
}

/**
 * Every whole-word occurrence of `title` in `line` that is NOT already inside
 * a [[wikilink]] — those are linked mentions and belong to the other section.
 */
function unlinkedOccurrencesInLine(line, title) {
  const out = [];
  if (!line || !title) return out;

  const spans = [];
  WIKILINK_RE.lastIndex = 0;
  let link;
  while ((link = WIKILINK_RE.exec(line)) !== null) {
    spans.push([link.index, link.index + link[0].length]);
  }

  const re = new RegExp(`\\b${escapeRegex(title)}\\b`, 'gi');
  let match;
  while ((match = re.exec(line)) !== null) {
    if (match[0].length === 0) { re.lastIndex++; continue; }
    const start = match.index;
    if (spans.some(([a, b]) => start >= a && start < b)) continue;
    out.push({ index: start, matchedText: match[0], context: snippetAt(line, start, match[0].length) });
  }
  return out;
}

/** Real markdown notes in the index — excludes phantoms, tags, attachments. */
function noteNodes(index) {
  return index ? index.nodes().filter((n) => !n.phantom && n.id.endsWith('.md')) : [];
}

/**
 * BacklinksPanel - Show all notes linking to current note
 */
export default function BacklinksPanel({
  workspacePath,
  currentFile,
  onOpenFile
}) {
  const [unlinkedMentions, setUnlinkedMentions] = useState([]);
  const [blockBacklinks, setBlockBacklinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedExpanded, setLinkedExpanded] = useState(true);
  const [blockBacklinksExpanded, setBlockBacklinksExpanded] = useState(false);
  const [unlinkedExpanded, setUnlinkedExpanded] = useState(false);
  const [expandedSources, setExpandedSources] = useState(new Set());

  // Linked mentions from the incremental link index — O(1) inverse-map
  // lookup with context snippets, live on every save (version bumps).
  const index = useGraphStore((s) => s.index);
  const indexVersion = useGraphStore((s) => s.version);
  const backlinks = useMemo(() => {
    if (!index || !currentFile) return [];
    return index.backlinks(currentFile).map(({ source, context }) => ({
      sourceNodeId: source,
      sourceTitle: source.split('/').pop().replace(/\.md$/i, ''),
      targetNodeId: currentFile,
      context,
      position: 0,
      linkText: '',
      created: 0,
    }));
  }, [index, indexVersion, currentFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // The note's own title — what other notes would be mentioning.
  const currentTitle = useMemo(
    () => (currentFile ? currentFile.split('/').pop().replace(/\.md$/i, '') : ''),
    [currentFile],
  );

  // Unlinked mentions: other notes whose text contains this note's title
  // without linking it. The index holds no file contents by design, so the
  // scan runs in Rust (`search_in_files`, whole-word, case-insensitive) and
  // only the matched LINES come back — then each line is re-scanned here for
  // every occurrence and for [[wikilink]] spans to exclude.
  //
  // Recomputed per file switch, not per save: a keystroke must never trigger
  // a vault walk.
  useEffect(() => {
    if (!workspacePath || !currentTitle || !index) {
      setUnlinkedMentions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await invoke('search_in_files', {
          query: currentTitle,
          workspacePath,
          options: {
            caseSensitive: false,
            wholeWord: true,
            regex: false,
            fileTypes: ['md'],
            maxResults: 500,
            contextLines: 0,
          },
        });
        if (cancelled) return;

        // The Rust walk sees the raw directory — keep only files the index
        // knows about, so `.lokus/trash` and friends can't show up.
        const known = new Set(noteNodes(index).map((n) => n.id));
        const mentions = [];

        for (const result of results || []) {
          if (result.file === currentFile) continue; // a note never mentions itself
          if (!known.has(result.file)) continue;
          const sourceTitle = result.file.split('/').pop().replace(/\.md$/i, '');

          for (const line of result.matches || []) {
            for (const occ of unlinkedOccurrencesInLine(line.text, currentTitle)) {
              mentions.push({
                sourceNodeId: result.file,
                sourceTitle,
                targetNodeId: currentFile,
                targetTitle: currentTitle,
                position: line.line * 10000 + occ.index,
                matchedText: occ.matchedText,
                context: occ.context,
              });
            }
          }
        }

        setUnlinkedMentions(mentions);
      } catch (err) {
        if (!cancelled) setUnlinkedMentions([]);
      }
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [workspacePath, currentFile, currentTitle, index]);

  // Block backlinks — a separate index ([[File^blockid]]), fed the note list
  // from the graph2 index.
  useEffect(() => {
    if (!currentTitle || !index) {
      setBlockBacklinks([]);
      return;
    }

    let cancelled = false;
    const read = () => {
      if (!cancelled) setBlockBacklinks(blockBacklinkManager.getFileBlockBacklinks(currentTitle));
    };

    if (!blockBacklinkManager.indexed) {
      const fileIndex = noteNodes(index).map((n) => ({ path: n.id, title: n.title }));
      blockBacklinkManager.indexBlockLinks(fileIndex).then(read).catch((err) => {
        console.error('BacklinksPanel: Failed to index block links', err);
      });
    }
    read();

    return () => { cancelled = true; };
  }, [currentTitle, index]);

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

  // Open the source note. Node ids ARE paths in the graph2 index; a phantom
  // (`phantom:name`) has no file behind it and is not clickable.
  const openSource = useCallback((sourceNodeId) => {
    if (!onOpenFile || !sourceNodeId || sourceNodeId.startsWith('phantom:')) return;
    onOpenFile({ path: sourceNodeId, name: sourceNodeId.split('/').pop().replace(/\.md$/i, '') });
  }, [onOpenFile]);

  const handleBacklinkClick = useCallback(
    (backlink) => openSource(backlink.sourceNodeId),
    [openSource],
  );

  const handleMentionClick = useCallback(
    (mention) => openSource(mention.sourceNodeId),
    [openSource],
  );

  // Render context snippet
  const renderContext = useCallback((context) => {
    // A match at the start or end of a line has no text on one side — that is
    // still context worth showing, so only bail when there is nothing at all.
    if (!context || (!context.before && !context.after && !context.match)) {
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
