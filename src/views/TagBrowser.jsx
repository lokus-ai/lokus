import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Tag, Search, X, ChevronRight, ChevronDown, Hash, Pencil, Trash2 } from 'lucide-react';
import tagManager from '../core/tags/tag-manager.js';

/**
 * Tag Browser Component
 * Displays all tags in the workspace with counts and filtering
 */
export default function TagBrowser({ onTagClick, selectedTags = [], onClear }) {
  const [tags, setTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [hoveredTag, setHoveredTag] = useState(null);
  const [showTagActions, setShowTagActions] = useState(null);
  const searchInputRef = useRef(null);

  // Load tags from tag manager
  const loadTags = useCallback(() => {
    const allTags = searchQuery
      ? tagManager.searchTags(searchQuery)
      : tagManager.getAllTags();

    setTags(allTags);
  }, [searchQuery]);

  // Listen to tag changes
  useEffect(() => {
    loadTags();

    const handleTagsChanged = () => loadTags();
    tagManager.on('tags-changed', handleTagsChanged);

    return () => {
      tagManager.off('tags-changed', handleTagsChanged);
    };
  }, [loadTags]);

  // Organize tags into hierarchy
  const tagHierarchy = useMemo(() => {
    const hierarchy = {};

    tags.forEach(({ tag, count, notes }) => {
      const parts = tag.split('/');
      let current = hierarchy;

      parts.forEach((part, index) => {
        if (!current[part]) {
          const fullPath = parts.slice(0, index + 1).join('/');
          current[part] = {
            name: part,
            fullPath,
            count: 0,
            notes: [],
            children: {},
            isLeaf: index === parts.length - 1
          };
        }

        // Update count and notes for this level
        if (index === parts.length - 1) {
          current[part].count = count;
          current[part].notes = notes;
        }

        current = current[part].children;
      });
    });

    return hierarchy;
  }, [tags]);

  // Toggle tag expansion
  const toggleExpanded = (tag) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  // Handle tag click
  const handleTagClick = (tag) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  // Handle tag rename
  const handleRename = (oldTag) => {
    const newTag = prompt(`Rename tag "${oldTag}" to:`, oldTag);
    if (newTag && newTag !== oldTag) {
      const count = tagManager.renameTag(oldTag, newTag);
      if (count > 0) {
        alert(`Renamed tag in ${count} note(s)`);
      }
    }
  };

  // Handle tag delete
  const handleDelete = (tag) => {
    if (confirm(`Delete tag "${tag}" from all notes?`)) {
      const count = tagManager.deleteTag(tag);
      if (count > 0) {
        alert(`Removed tag from ${count} note(s)`);
      }
    }
  };

  // Render tag item
  const renderTagItem = (tagData, depth = 0) => {
    const { name, fullPath, count, children, isLeaf } = tagData;
    const hasChildren = Object.keys(children).length > 0;
    const isExpanded = expandedTags.has(fullPath);
    const isSelected = selectedTags.includes(fullPath);
    const isHovered = hoveredTag === fullPath;

    return (
      <div key={fullPath}>
        {/* Tag Item */}
        <div
          className="tag-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            paddingLeft: `${depth * 16 + 8}px`,
            cursor: 'pointer',
            fontSize: '13px',
            color: isSelected ? 'var(--accent)' : 'var(--text)',
            backgroundColor: isSelected ? 'var(--panel)' : 'transparent',
            fontWeight: isSelected ? '600' : '400',
            borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
            transition: 'all 0.15s ease',
            position: 'relative'
          }}
          onMouseEnter={() => setHoveredTag(fullPath)}
          onMouseLeave={() => setHoveredTag(null)}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasChildren || e.target.closest('.tag-expand-button')) {
              handleTagClick(fullPath);
            }
          }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              className="tag-expand-button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(fullPath);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--muted)',
                marginRight: '4px'
              }}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          )}

          {/* Tag Icon */}
          <Hash
            size={14}
            style={{
              marginRight: '6px',
              color: 'var(--muted)',
              flexShrink: 0
            }}
          />

          {/* Tag Name */}
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={fullPath}
          >
            {name}
          </span>

          {/* Tag Count */}
          <span
            style={{
              marginLeft: '8px',
              fontSize: '11px',
              color: 'var(--muted)',
              backgroundColor: 'var(--border)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: '500'
            }}
          >
            {count}
          </span>

          {/* Tag Actions (on hover) */}
          {isHovered && (
            <div
              style={{
                marginLeft: '4px',
                display: 'flex',
                gap: '2px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleRename(fullPath)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  color: 'var(--muted)',
                  opacity: 0.6
                }}
                title="Rename tag"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleDelete(fullPath)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  color: 'var(--danger)',
                  opacity: 0.6
                }}
                title="Delete tag"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Children (if expanded) */}
        {hasChildren && isExpanded && (
          <div>
            {Object.values(children).map((child) => renderTagItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get statistics
  const stats = useMemo(() => tagManager.getStats(), [tags]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '13px'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 8px 8px 8px',
          fontWeight: '600',
          fontSize: '12px',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          letterSpacing: '0.5px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>Tags ({stats.totalTags})</span>

        {selectedTags.length > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--accent)',
              padding: '2px 4px'
            }}
            title="Clear filter"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div
        style={{
          padding: '8px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px'
          }}
        >
          <Search size={14} style={{ color: 'var(--muted)', marginRight: '6px' }} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text)'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                color: 'var(--muted)',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Selected Tags Info */}
      {selectedTags.length > 0 && (
        <div
          style={{
            padding: '8px',
            backgroundColor: 'var(--panel)',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--muted)'
          }}
        >
          Filtering by {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Tags List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 0'
        }}
      >
        {tags.length === 0 ? (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '13px'
            }}
          >
            {searchQuery ? 'No tags found' : 'No tags yet'}
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              {!searchQuery && 'Add #tags to your notes'}
            </div>
          </div>
        ) : (
          Object.values(tagHierarchy).map((tagData) => renderTagItem(tagData))
        )}
      </div>

      {/* Stats Footer */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--muted)',
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <span>{stats.notesWithTags} notes tagged</span>
        <span>Avg: {stats.averageTagsPerNote.toFixed(1)} tags/note</span>
      </div>
    </div>
  );
}
