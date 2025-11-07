import React, { useState, useMemo } from 'react';
import {
  Eye,
  Download,
  Trash2,
  FileText,
  ScanLine,
  Link,
  MoreVertical,
  Check
} from 'lucide-react';
import './MediaGrid.css';

const MediaGrid = ({ files, onSelect, onDelete, onOCR }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [showContextMenu, setShowContextMenu] = useState(null);

  const handleItemClick = (file, event) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      setSelectedItems(prev =>
        prev.includes(file.path)
          ? prev.filter(p => p !== file.path)
          : [...prev, file.path]
      );
    } else if (event.shiftKey && selectedItems.length > 0) {
      // Range select with Shift
      const currentIndex = files.findIndex(f => f.path === file.path);
      const lastSelectedIndex = files.findIndex(f => f.path === selectedItems[selectedItems.length - 1]);

      const start = Math.min(currentIndex, lastSelectedIndex);
      const end = Math.max(currentIndex, lastSelectedIndex);

      const range = files.slice(start, end + 1).map(f => f.path);
      setSelectedItems(range);
    } else {
      // Single select
      setSelectedItems([file.path]);
      onSelect(file);
    }
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setShowContextMenu({
      x: event.clientX,
      y: event.clientY,
      file
    });
  };

  const getThumbnail = (file) => {
    if (file.thumbnail_path) {
      return file.thumbnail_path;
    }

    // Generate placeholder based on type
    switch (file.mediaType) {
      case 'Image':
        return file.path; // Use actual image as thumbnail
      case 'Pdf':
        return '/pdf-placeholder.svg';
      case 'Video':
        return '/video-placeholder.svg';
      case 'Audio':
        return '/audio-placeholder.svg';
      default:
        return '/file-placeholder.svg';
    }
  };

  const getFileSize = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getRelativeTime = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const groupedFiles = useMemo(() => {
    // Group files by date for better organization
    const groups = {};

    files.forEach(file => {
      const date = new Date(file.metadata?.modified_at || file.modified);
      const dateKey = date.toDateString();

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          relativeTime: getRelativeTime(date),
          files: []
        };
      }

      groups[dateKey].files.push(file);
    });

    return Object.values(groups).sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );
  }, [files]);

  return (
    <div className="media-grid-container">
      {groupedFiles.map(group => (
        <div key={group.date} className="media-group">
          <h3 className="media-group-header">
            {group.relativeTime}
            <span className="file-count">{group.files.length} files</span>
          </h3>

          <div className="media-grid">
            {group.files.map(file => (
              <div
                key={file.path}
                className={`media-item ${selectedItems.includes(file.path) ? 'selected' : ''}`}
                onClick={(e) => handleItemClick(file, e)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                {/* Thumbnail */}
                <div className="media-thumbnail">
                  {file.mediaType === 'Image' ? (
                    <img
                      src={`file://${file.path}`}
                      alt={file.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className={`placeholder ${file.mediaType.toLowerCase()}`}>
                      <FileText size={48} />
                      <span className="file-extension">
                        {file.path.split('.').pop().toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {selectedItems.includes(file.path) && (
                    <div className="selection-indicator">
                      <Check size={16} />
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="quick-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(file);
                      }}
                      title="Preview"
                    >
                      <Eye size={16} />
                    </button>

                    {file.mediaType === 'Image' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOCR(file);
                        }}
                        title="Extract Text (OCR)"
                      >
                        <ScanLine size={16} />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          file
                        });
                      }}
                      title="More Options"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  {/* Processing status */}
                  {file.processing && (
                    <div className="processing-overlay">
                      <div className="spinner" />
                      <span>Processing...</span>
                    </div>
                  )}

                  {/* OCR confidence badge */}
                  {file.ocrConfidence && (
                    <div className={`confidence-badge ${
                      file.ocrConfidence > 0.8 ? 'high' :
                      file.ocrConfidence > 0.6 ? 'medium' : 'low'
                    }`}>
                      OCR: {Math.round(file.ocrConfidence * 100)}%
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="media-info">
                  <div className="file-name" title={file.name}>
                    {file.name}
                  </div>
                  <div className="file-meta">
                    <span className="file-size">
                      {getFileSize(file.metadata?.file_size || file.size)}
                    </span>
                    {file.metadata?.dimensions && (
                      <span className="file-dimensions">
                        {file.metadata.dimensions.width} × {file.metadata.dimensions.height}
                      </span>
                    )}
                  </div>

                  {/* Concepts/Tags */}
                  {file.concepts && file.concepts.length > 0 && (
                    <div className="file-concepts">
                      {file.concepts.slice(0, 3).map(concept => (
                        <span key={concept} className="concept-tag">
                          {concept}
                        </span>
                      ))}
                      {file.concepts.length > 3 && (
                        <span className="more-concepts">
                          +{file.concepts.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Linked documents indicator */}
                  {file.linkedDocuments && file.linkedDocuments.length > 0 && (
                    <div className="linked-indicator">
                      <Link size={12} />
                      <span>{file.linkedDocuments.length} linked</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="context-menu-overlay"
            onClick={() => setShowContextMenu(null)}
          />
          <div
            className="context-menu"
            style={{
              left: showContextMenu.x,
              top: showContextMenu.y
            }}
          >
            <button onClick={() => {
              onSelect(showContextMenu.file);
              setShowContextMenu(null);
            }}>
              <Eye size={16} />
              Preview
            </button>

            {showContextMenu.file.mediaType === 'Image' && (
              <button onClick={() => {
                onOCR(showContextMenu.file);
                setShowContextMenu(null);
              }}>
                <ScanLine size={16} />
                Extract Text (OCR)
              </button>
            )}

            <button onClick={() => {
              navigator.clipboard.writeText(showContextMenu.file.path);
              setShowContextMenu(null);
            }}>
              <Link size={16} />
              Copy Path
            </button>

            <button onClick={() => {
              // Download/export functionality
              setShowContextMenu(null);
            }}>
              <Download size={16} />
              Export
            </button>

            <div className="context-menu-divider" />

            <button
              className="danger"
              onClick={() => {
                onDelete(showContextMenu.file);
                setShowContextMenu(null);
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MediaGrid;