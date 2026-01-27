import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, FileText, Hash, Clock, Search, ChevronRight } from 'lucide-react';
import {
  createFileMatcher,
  createHeadingMatcher,
  createTagMatcher,
  extractHeadings,
  extractTags,
  getPreviewText,
  sortResults,
  highlightMatches,
} from '../core/search/fuzzy-matcher.js';
import '../styles/quick-switcher.css';
import { isDesktop } from '../platform/index.js';

/**
 * Enhanced Quick Switcher Component
 *
 * Features:
 * - Fuzzy search files with Fuse.js
 * - Search in headings (shows file + heading)
 * - Search in tags
 * - Recent files at top
 * - Preview pane (shows first lines)
 * - Keyboard navigation: Up/Down/Enter, Tab for preview
 * - Cmd+Enter opens in split pane
 * - Global shortcut: Cmd/Ctrl+O
 */
export default function QuickSwitcher({ isOpen, onClose, onSelectFile, workspacePath, recentFiles = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [searchMode, setSearchMode] = useState('all'); // 'all', 'files', 'headings', 'tags'
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // File index and data
  const [fileIndex, setFileIndex] = useState([]);
  const [headingsIndex, setHeadingsIndex] = useState([]);
  const [tagsIndex, setTagsIndex] = useState([]);

  // Load file index
  useEffect(() => {
    if (!isOpen) return;

    const loadFileIndex = async () => {
      setLoading(true);
      try {
        // Get file index from global
        const index = globalThis.__LOKUS_FILE_INDEX__ || [];

        // Build file list
        const files = index.map((file) => ({
          path: file.path,
          name: file.name || file.path.split('/').pop(),
          content: file.content || '',
          lastModified: file.lastModified || Date.now(),
        }));

        setFileIndex(files);

        // Extract headings from all files
        const allHeadings = [];
        files.forEach((file) => {
          const headings = extractHeadings(file.content, file.path);
          allHeadings.push(...headings);
        });
        setHeadingsIndex(allHeadings);

        // Extract tags from all files
        const tagMap = new Map();
        files.forEach((file) => {
          const tags = extractTags(file.content);
          tags.forEach((tag) => {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, []);
            }
            tagMap.get(tag).push(file.path);
          });
        });

        const tagsList = Array.from(tagMap.entries()).map(([tag, files]) => ({
          tag,
          files,
          count: files.length,
        }));
        setTagsIndex(tagsList);

        // Show recent files initially
        if (recentFiles.length > 0) {
          const recentItems = recentFiles
            .map((path) => files.find((f) => f.path === path))
            .filter(Boolean)
            .slice(0, 10);
          setResults(recentItems);
        } else {
          setResults(files.slice(0, 10));
        }
      } catch (err) {
        console.error('QuickSwitcher: Failed to load file index', err);
      } finally {
        setLoading(false);
      }
    };

    loadFileIndex();
  }, [isOpen, recentFiles]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      // Show recent files when no query
      if (recentFiles.length > 0) {
        const recentItems = recentFiles
          .map((path) => fileIndex.find((f) => f.path === path))
          .filter(Boolean)
          .slice(0, 10);
        setResults(recentItems);
      } else {
        setResults(fileIndex.slice(0, 10));
      }
      setSelectedIndex(0);
      return;
    }

    // Perform fuzzy search based on mode
    let searchResults = [];

    if (searchMode === 'all' || searchMode === 'files') {
      const fileMatcher = createFileMatcher(fileIndex);
      const fileResults = fileMatcher.search(query);
      searchResults.push(
        ...fileResults.map((r) => ({
          type: 'file',
          ...r,
        }))
      );
    }

    if (searchMode === 'all' || searchMode === 'headings') {
      const headingMatcher = createHeadingMatcher(headingsIndex);
      const headingResults = headingMatcher.search(query);
      searchResults.push(
        ...headingResults.map((r) => ({
          type: 'heading',
          ...r,
        }))
      );
    }

    if (searchMode === 'all' || searchMode === 'tags') {
      const tagMatcher = createTagMatcher(tagsIndex);
      const tagResults = tagMatcher.search(query);
      searchResults.push(
        ...tagResults.map((r) => ({
          type: 'tag',
          ...r,
        }))
      );
    }

    // Sort results by score and recency
    searchResults = sortResults(searchResults, recentFiles);

    // Limit results
    searchResults = searchResults.slice(0, 50);

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, searchMode, fileIndex, headingsIndex, tagsIndex, recentFiles]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;

        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            const item = results[selectedIndex];
            const openInSplit = e.metaKey || e.ctrlKey;
            handleSelect(item, openInSplit);
          }
          break;

        case 'Tab':
          e.preventDefault();
          setShowPreview((prev) => !prev);
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;

        default:
          break;
      }
    },
    [isOpen, results, selectedIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, results]);

  // Load preview for selected item
  useEffect(() => {
    if (!showPreview || !results[selectedIndex]) {
      setPreviewContent('');
      return;
    }

    const item = results[selectedIndex];
    const file = item.type === 'file' ? item.item : fileIndex.find((f) => f.path === item.item.file);

    if (file) {
      setPreviewContent(getPreviewText(file.content, 500));
    }
  }, [selectedIndex, showPreview, results, fileIndex]);

  // Handle item selection
  const handleSelect = (item, openInSplit = false) => {
    let filePath = '';

    if (item.type === 'file') {
      filePath = item.item.path;
    } else if (item.type === 'heading') {
      filePath = item.item.file;
    } else if (item.type === 'tag') {
      // Open first file with this tag
      filePath = item.item.files[0];
    }

    if (filePath) {
      onSelectFile(filePath, openInSplit);
      onClose();
    }
  };

  // Render result item
  const renderResultItem = (item, index) => {
    const isSelected = index === selectedIndex;

    if (item.type === 'file') {
      const file = item.item;
      return (
        <div
          key={`file-${file.path}`}
          className={`quick-switcher-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <FileText size={16} className="item-icon" />
          <div className="item-content">
            <div
              className="item-title"
              dangerouslySetInnerHTML={{
                __html: highlightMatches(file.name, item.matches),
              }}
            />
            <div className="item-subtitle">{file.path}</div>
          </div>
        </div>
      );
    }

    if (item.type === 'heading') {
      const heading = item.item;
      const fileName = heading.file.split('/').pop();
      return (
        <div
          key={`heading-${heading.file}-${heading.position}`}
          className={`quick-switcher-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Hash size={16} className="item-icon" />
          <div className="item-content">
            <div
              className="item-title"
              dangerouslySetInnerHTML={{
                __html: highlightMatches(heading.text, item.matches),
              }}
            />
            <div className="item-subtitle">
              {fileName} <ChevronRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> H{heading.level}
            </div>
          </div>
        </div>
      );
    }

    if (item.type === 'tag') {
      const tag = item.item;
      return (
        <div
          key={`tag-${tag.tag}`}
          className={`quick-switcher-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Hash size={16} className="item-icon" />
          <div className="item-content">
            <div
              className="item-title"
              dangerouslySetInnerHTML={{
                __html: `#${highlightMatches(tag.tag, item.matches)}`,
              }}
            />
            <div className="item-subtitle">{tag.count} file(s)</div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div className="quick-switcher-container" onClick={(e) => e.stopPropagation()}>
        <div className="quick-switcher-header">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files, headings, or tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="quick-switcher-input"
          />
          <button onClick={onClose} className="close-button">
            <X size={18} />
          </button>
        </div>

        <div className="quick-switcher-mode-selector">
          <button
            className={`mode-button ${searchMode === 'all' ? 'active' : ''}`}
            onClick={() => setSearchMode('all')}
          >
            All
          </button>
          <button
            className={`mode-button ${searchMode === 'files' ? 'active' : ''}`}
            onClick={() => setSearchMode('files')}
          >
            Files
          </button>
          <button
            className={`mode-button ${searchMode === 'headings' ? 'active' : ''}`}
            onClick={() => setSearchMode('headings')}
          >
            Headings
          </button>
          <button
            className={`mode-button ${searchMode === 'tags' ? 'active' : ''}`}
            onClick={() => setSearchMode('tags')}
          >
            Tags
          </button>
        </div>

        <div className="quick-switcher-body">
          <div className="quick-switcher-results" ref={resultsRef}>
            {loading ? (
              <div className="loading-message">Loading...</div>
            ) : results.length === 0 ? (
              <div className="no-results-message">
                {query ? 'No results found' : 'No recent files'}
              </div>
            ) : (
              results.map((item, index) => renderResultItem(item, index))
            )}
          </div>

          {showPreview && previewContent && (
            <div className="quick-switcher-preview">
              <div className="preview-header">Preview</div>
              <div className="preview-content">{previewContent}</div>
            </div>
          )}
        </div>

        <div className="quick-switcher-footer">
          {isDesktop() && (
            <div className="footer-hint">
              <kbd>↑↓</kbd> Navigate
              <kbd>Enter</kbd> Open
              <kbd>{isWindows ? 'Ctrl+Enter' : '⌘Enter'}</kbd> Split
              <kbd>Tab</kbd> Preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
