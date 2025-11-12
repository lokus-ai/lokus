import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openFile } from '@tauri-apps/plugin-dialog';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Images,
  FileText,
  Search,
  Filter,
  X,
  Eye,
  FolderOpen,
  Copy,
  Trash2,
  RefreshCw,
  Grid3x3,
  List as ListIcon,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { LRUCache } from '../../utils/lru-cache';
import ImageLightbox from './ImageLightbox';
import './MediaGallery.css';

const MediaGallery = ({ workspace }) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [sortBy, setSortBy] = useState('date'); // date, name, size, type
  const [sortOrder, setSortOrder] = useState('desc'); // asc or desc
  const [filterType, setFilterType] = useState('all'); // all, image, pdf
  const [selectedFile, setSelectedFile] = useState(null);
  const [thumbnailVersion, setThumbnailVersion] = useState(0); // Trigger re-render on cache updates
  const [columns, setColumns] = useState(5); // Number of grid columns
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxFile, setLightboxFile] = useState(null);

  const parentRef = useRef(null);
  const listParentRef = useRef(null);
  const thumbnailCache = useRef(new LRUCache(200)); // LRU cache with 200 item limit

  // Calculate number of columns based on container width
  useEffect(() => {
    const updateColumns = () => {
      if (parentRef.current) {
        const width = parentRef.current.offsetWidth;
        const minCardWidth = 180;
        const gap = 16;
        const cols = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
        setColumns(cols);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Load media files on mount
  useEffect(() => {
    if (workspace && workspace.path) {
      scanWorkspace();
    }
  }, [workspace]);

  // Debounce search term (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Memoized filtered and sorted files (O(n) + O(n log n) only when dependencies change)
  const filteredFiles = useMemo(() => {
    let filtered = [...mediaFiles];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(file => {
        if (filterType === 'image') return file.media_type === 'Image';
        if (filterType === 'pdf') return file.media_type === 'Pdf';
        return true;
      });
    }

    // Apply search filter (debounced)
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(file =>
        file.metadata.file_name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.metadata.file_name.localeCompare(b.metadata.file_name);
          break;
        case 'size':
          comparison = a.metadata.file_size - b.metadata.file_size;
          break;
        case 'type':
          comparison = a.media_type.localeCompare(b.media_type);
          break;
        case 'date':
        default:
          comparison = new Date(a.metadata.modified_at) - new Date(b.metadata.modified_at);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [debouncedSearchTerm, filterType, sortBy, sortOrder, mediaFiles]);

  // Calculate rows for grid view
  const gridRows = Math.ceil(filteredFiles.length / columns);

  // Grid virtualizer - optimized for smooth scrolling
  const rowVirtualizer = useVirtualizer({
    count: gridRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Increased estimate: card (250px) + margin
    overscan: 5, // Increased from 2 to 5 for smoother scrolling
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined, // Use measured sizes in browsers that support it
  });

  // List virtualizer - optimized for smooth scrolling
  const listVirtualizer = useVirtualizer({
    count: filteredFiles.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 85, // Slightly increased estimate with padding
    overscan: 10, // Increased from 5 to 10 for smoother scrolling
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined,
  });

  // Load thumbnails with concurrency limiting and batching
  useEffect(() => {
    let isCancelled = false;
    const MAX_CONCURRENT = 3; // Limit concurrent requests
    const BATCH_SIZE = 10; // Process in small batches

    const loadThumbnailsBatched = async () => {
      const imageFiles = filteredFiles.filter(f => f.media_type === 'Image');
      const cache = thumbnailCache.current;
      const filesToLoad = imageFiles.filter(file => !cache.has(file.id));

      if (filesToLoad.length === 0) return;

      // Process in batches
      for (let i = 0; i < filesToLoad.length; i += BATCH_SIZE) {
        if (isCancelled) break;

        const batch = filesToLoad.slice(i, Math.min(i + BATCH_SIZE, filesToLoad.length));

        // Process batch with concurrency limit
        const semaphore = new Array(MAX_CONCURRENT).fill(null);
        let currentIndex = 0;

        const loadThumbnail = async (file) => {
          try {
            const thumbnailPath = await invoke('get_thumbnail', {
              imagePath: file.file_path,
              workspacePath: workspace.path
            });

            if (!isCancelled) {
              cache.set(file.id, thumbnailPath);
              setThumbnailVersion(v => v + 1); // Trigger re-render
            }
          } catch (error) {
            console.error(`Error loading thumbnail for ${file.metadata.file_name}:`, error);
            if (!isCancelled) {
              // Fallback to original image
              cache.set(file.id, file.file_path);
              setThumbnailVersion(v => v + 1);
            }
          }
        };

        // Run with concurrency limit
        const workers = semaphore.map(async () => {
          while (currentIndex < batch.length && !isCancelled) {
            const file = batch[currentIndex++];
            await loadThumbnail(file);
          }
        });

        await Promise.all(workers);
      }
    };

    if (workspace && workspace.path && filteredFiles.length > 0) {
      loadThumbnailsBatched();
    }

    return () => {
      isCancelled = true; // Cleanup on unmount
    };
  }, [filteredFiles, workspace]);

  // Helper to get thumbnail path from cache
  const getThumbnail = useCallback((fileId) => {
    const path = thumbnailCache.current.get(fileId);
    return path || null;
  }, [thumbnailVersion]); // Re-create when cache updates

  const scanWorkspace = async () => {
    setLoading(true);
    try {
      const files = await invoke('scan_workspace_media', {
        workspacePath: workspace.path
      });
      setMediaFiles(files);
    } catch (error) {
      console.error('Error scanning workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file, event) => {
    setSelectedFile(file);

    // Cmd/Ctrl+Click: Open as tab in workspace
    if (event?.metaKey || event?.ctrlKey) {
      // TODO: Implement opening file as tab in workspace
      // This would require integrating with the workspace's tab system
      console.log('Opening as tab not yet implemented:', file.file_path);
      return;
    }

    // Regular click: Open viewer modal for images
    if (file.media_type === 'Image') {
      setLightboxFile(file);
      setShowLightbox(true);
    } else if (file.media_type === 'Pdf') {
      // TODO: Open PDF viewer (will be implemented in next step)
      console.log('PDF viewer not yet implemented');
    }
  };

  const handleFileDoubleClick = async (file) => {
    // Open file in default application
    try {
      await openShell(file.file_path);
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const handleRevealInFinder = async (file) => {
    try {
      await invoke('reveal_in_finder', { path: file.file_path });
    } catch (error) {
      console.error('Error revealing file:', error);
    }
  };

  const handleCopyPath = (file) => {
    navigator.clipboard.writeText(file.file_path);
  };

  const handleDelete = async (file) => {
    if (confirm(`Delete ${file.metadata.file_name}?`)) {
      try {
        await invoke('delete_file', { path: file.file_path });
        // Refresh the list
        scanWorkspace();
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const handleOCR = async (file) => {
    try {
      const result = await invoke('ocr_process_image', {
        imagePath: file.file_path
      });
      alert(`Extracted text:\n\n${result.text}`);
    } catch (error) {
      console.error('Error performing OCR:', error);
      alert('OCR failed. Make sure Tesseract is installed.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handleCloseLightbox = () => {
    setShowLightbox(false);
    setLightboxFile(null);
  };

  const handleInsertImage = (file) => {
    // TODO: Implement insert into editor
    console.log('Insert image into note:', file);
    // For now, just close the lightbox
    handleCloseLightbox();
  };

  const stats = {
    total: mediaFiles.length,
    images: mediaFiles.filter(f => f.media_type === 'Image').length,
    pdfs: mediaFiles.filter(f => f.media_type === 'Pdf').length
  };

  return (
    <div className="media-library">
      {/* Header */}
      <div className="media-library-header">
        <div className="header-left">
          <Images size={24} />
          <h2>Media Library</h2>
          <span className="file-count">
            {stats.total} files ({stats.images} images, {stats.pdfs} PDFs)
          </span>
        </div>
        <button
          onClick={scanWorkspace}
          className="refresh-button"
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="media-toolbar">
        <div className="toolbar-left">
          {/* Search */}
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="clear-search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="filter-buttons">
            <button
              className={filterType === 'all' ? 'active' : ''}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              className={filterType === 'image' ? 'active' : ''}
              onClick={() => setFilterType('image')}
            >
              <Images size={14} />
              Images ({stats.images})
            </button>
            <button
              className={filterType === 'pdf' ? 'active' : ''}
              onClick={() => setFilterType('pdf')}
            >
              <FileText size={14} />
              PDFs ({stats.pdfs})
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">Date Modified</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
          </button>

          {/* View Mode */}
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="media-content">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={32} className="spinning" />
            <p>Scanning workspace for media files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <Images size={48} />
            <h3>No media files found</h3>
            <p>
              {searchTerm || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Add images or PDFs to your workspace to see them here'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div ref={parentRef} className="media-grid-container" style={{ height: '100%', overflow: 'auto' }}>
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columns;
                const endIndex = Math.min(startIndex + columns, filteredFiles.length);
                const rowFiles = filteredFiles.slice(startIndex, endIndex);

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="media-grid-row" style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${columns}, 1fr)`,
                      gap: '1rem',
                      padding: '0 1.5rem',
                      marginBottom: '1rem'
                    }}>
                      {rowFiles.map((file) => (
                        <div
                          key={file.id}
                          className={`media-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                          onClick={(e) => handleFileClick(file, e)}
                          onDoubleClick={() => handleFileDoubleClick(file)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            handleFileClick(file, e);
                          }}
                        >
                          {/* Thumbnail */}
                          <div className="card-thumbnail">
                            {file.media_type === 'Image' ? (
                              <img
                                src={getThumbnail(file.id) ? `file://${getThumbnail(file.id)}` : `file://${file.file_path}`}
                                alt={file.metadata.file_name}
                                loading="lazy"
                              />
                            ) : (
                              <div className="pdf-placeholder">
                                <FileText size={48} />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="card-info">
                            <div className="file-name" title={file.metadata.file_name}>
                              {file.metadata.file_name}
                            </div>
                            <div className="file-meta">
                              <span>{formatFileSize(file.metadata.file_size)}</span>
                              <span>{formatDate(file.metadata.modified_at)}</span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="card-actions">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileClick(file);
                              }}
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPath(file);
                              }}
                              title="Copy Path"
                            >
                              <Copy size={14} />
                            </button>
                            {/* OCR feature removed for now */}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div ref={listParentRef} className="media-list-container" style={{ height: '100%', overflow: 'auto' }}>
            <div
              style={{
                height: `${listVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {listVirtualizer.getVirtualItems().map((virtualItem) => {
                const file = filteredFiles[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                      padding: '0 1.5rem',
                    }}
                  >
                    <div
                      className={`list-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                      onClick={(e) => handleFileClick(file, e)}
                      onDoubleClick={() => handleFileDoubleClick(file)}
                    >
                      <div className="list-icon">
                        {file.media_type === 'Image' ? (
                          <Images size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>
                      <div className="list-info">
                        <div className="list-name">{file.metadata.file_name}</div>
                        <div className="list-path">{file.file_path}</div>
                      </div>
                      <div className="list-meta">
                        <span>{formatFileSize(file.metadata.file_size)}</span>
                        <span>{formatDate(file.metadata.modified_at)}</span>
                      </div>
                      <div className="list-actions">
                        <button onClick={(e) => { e.stopPropagation(); handleFileDoubleClick(file); }} title="Open">
                          <Eye size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleRevealInFinder(file); }} title="Reveal">
                          <FolderOpen size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Context Menu (when file is selected) */}
      {selectedFile && (
        <div className="file-actions-panel">
          <button onClick={() => handleFileDoubleClick(selectedFile)}>
            <Eye size={16} />
            Open
          </button>
          <button onClick={() => handleRevealInFinder(selectedFile)}>
            <FolderOpen size={16} />
            Reveal in Finder
          </button>
          <button onClick={() => handleCopyPath(selectedFile)}>
            <Copy size={16} />
            Copy Path
          </button>
          {selectedFile.media_type === 'Image' && (
            <button onClick={() => handleOCR(selectedFile)}>
              <ScanLine size={16} />
              Extract Text
            </button>
          )}
          <button onClick={() => handleDelete(selectedFile)} className="danger">
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      )}

      {/* Image Lightbox */}
      {showLightbox && lightboxFile && (
        <ImageLightbox
          file={lightboxFile}
          allFiles={filteredFiles.filter(f => f.media_type === 'Image')}
          onClose={handleCloseLightbox}
          onInsert={handleInsertImage}
          workspace={workspace}
        />
      )}
    </div>
  );
};

export default MediaGallery;