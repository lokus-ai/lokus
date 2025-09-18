/**
 * FileExplorerPlugin.js - Example File Explorer Panel Plugin
 * 
 * Demonstrates how to create a custom file explorer panel that extends
 * the default file tree with additional features like bookmarks, 
 * recent files, and search functionality.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { uiAPI, PANEL_POSITIONS, PANEL_TYPES } from '../api/UIAPI.js';
import { invoke } from '@tauri-apps/api/core';
import { 
  FolderOpen, 
  File, 
  Search, 
  Star, 
  Clock, 
  Filter,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2
} from 'lucide-react';

// File Explorer Panel Component
const FileExplorerPanel = ({ panel }) => {
  const [activeTab, setActiveTab] = useState('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Load initial data
  useEffect(() => {
    loadFileTree();
    loadBookmarks();
    loadRecentFiles();
  }, []);

  const loadFileTree = async () => {
    try {
      const workspacePath = window.__LOKUS_WORKSPACE_PATH__;
      if (workspacePath) {
        const files = await invoke('read_workspace_files', { workspacePath });
        setFileTree(files || []);
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  };

  const loadBookmarks = () => {
    try {
      const saved = localStorage.getItem('lokus-file-explorer-bookmarks');
      setBookmarks(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  };

  const loadRecentFiles = () => {
    try {
      const saved = localStorage.getItem('lokus-file-explorer-recent');
      setRecentFiles(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.error('Failed to load recent files:', error);
    }
  };

  const saveBookmarks = useCallback((newBookmarks) => {
    try {
      localStorage.setItem('lokus-file-explorer-bookmarks', JSON.stringify(newBookmarks));
      setBookmarks(newBookmarks);
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
    }
  }, []);

  const addBookmark = useCallback((path, name) => {
    const newBookmark = {
      id: Date.now().toString(),
      path,
      name,
      createdAt: new Date().toISOString()
    };
    const newBookmarks = [...bookmarks, newBookmark];
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);

  const removeBookmark = useCallback((id) => {
    const newBookmarks = bookmarks.filter(bookmark => bookmark.id !== id);
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  const handleFileClick = useCallback((file) => {
    // Emit event to open file in main editor
    const event = new CustomEvent('lokus:open-file', { detail: file.path });
    window.dispatchEvent(event);

    // Add to recent files
    const newRecentFile = {
      path: file.path,
      name: file.name,
      lastOpened: new Date().toISOString()
    };
    
    const newRecentFiles = [
      newRecentFile,
      ...recentFiles.filter(f => f.path !== file.path)
    ].slice(0, 10); // Keep only 10 recent files

    setRecentFiles(newRecentFiles);
    try {
      localStorage.setItem('lokus-file-explorer-recent', JSON.stringify(newRecentFiles));
    } catch (error) {
      console.error('Failed to save recent files:', error);
    }
  }, [recentFiles]);

  // Filter files based on search query
  const filterFiles = useCallback((files, query) => {
    if (!query) return files;
    
    const queryLower = query.toLowerCase();
    return files.filter(file => 
      file.name.toLowerCase().includes(queryLower)
    ).map(file => ({
      ...file,
      children: file.children ? filterFiles(file.children, query) : undefined
    }));
  }, []);

  // Render file tree item
  const renderFileItem = useCallback((file, level = 0) => {
    const isFolder = file.is_directory;
    const isExpanded = expandedFolders.has(file.path);
    const hasChildren = isFolder && file.children && file.children.length > 0;

    return (
      <div key={file.path} className="select-none">
        <div 
          className="flex items-center py-1 px-2 hover:bg-app-border/50 rounded cursor-pointer group"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => isFolder ? toggleFolder(file.path) : handleFileClick(file)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isFolder ? (
              <>
                {hasChildren && (
                  isExpanded ? 
                    <ChevronDown className="w-4 h-4 text-app-muted flex-shrink-0" /> :
                    <ChevronRight className="w-4 h-4 text-app-muted flex-shrink-0" />
                )}
                <FolderOpen className="w-4 h-4 text-app-accent flex-shrink-0" />
              </>
            ) : (
              <File className="w-4 h-4 text-app-muted flex-shrink-0" />
            )}
            <span className="text-sm text-app-text truncate">{file.name}</span>
          </div>
          
          {!isFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addBookmark(file.path, file.name);
              }}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-app-accent/20 text-app-muted hover:text-app-accent transition-all"
              title="Add to bookmarks"
            >
              <Star className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {isFolder && isExpanded && hasChildren && (
          <div>
            {file.children.map(child => renderFileItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedFolders, toggleFolder, handleFileClick, addBookmark]);

  // Render bookmarks tab
  const renderBookmarksTab = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-app-text">Bookmarks</h3>
        <span className="text-xs text-app-muted">{bookmarks.length} items</span>
      </div>
      
      {bookmarks.length === 0 ? (
        <div className="text-center py-8 text-app-muted">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No bookmarks yet</p>
          <p className="text-xs mt-1">Star files to bookmark them</p>
        </div>
      ) : (
        <div className="space-y-1">
          {bookmarks.map(bookmark => (
            <div 
              key={bookmark.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-app-border/50 cursor-pointer group"
              onClick={() => handleFileClick({ path: bookmark.path, name: bookmark.name })}
            >
              <Star className="w-4 h-4 text-app-accent flex-shrink-0" />
              <span className="text-sm text-app-text truncate flex-1">{bookmark.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeBookmark(bookmark.id);
                }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-app-danger/20 text-app-muted hover:text-app-danger transition-all"
                title="Remove bookmark"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render recent files tab
  const renderRecentTab = () => (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-app-text">Recent Files</h3>
        <span className="text-xs text-app-muted">{recentFiles.length} items</span>
      </div>
      
      {recentFiles.length === 0 ? (
        <div className="text-center py-8 text-app-muted">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent files</p>
          <p className="text-xs mt-1">Open files to see them here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {recentFiles.map(file => (
            <div 
              key={file.path}
              className="flex items-center gap-2 p-2 rounded hover:bg-app-border/50 cursor-pointer"
              onClick={() => handleFileClick(file)}
            >
              <File className="w-4 h-4 text-app-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-app-text truncate">{file.name}</div>
                <div className="text-xs text-app-muted">
                  {new Date(file.lastOpened).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render files tab
  const renderFilesTab = () => {
    const filteredFiles = filterFiles(fileTree, searchQuery);
    
    return (
      <div>
        {/* Search */}
        <div className="p-4 border-b border-app-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-app-bg border border-app-border rounded text-sm text-app-text placeholder-app-muted focus:outline-none focus:border-app-accent"
            />
          </div>
        </div>
        
        {/* File tree */}
        <div className="overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-app-muted">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files found</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredFiles.map(file => renderFileItem(file))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Tab bar */}
      <div className="flex border-b border-app-border bg-app-panel">
        {[
          { id: 'files', label: 'Files', icon: FolderOpen },
          { id: 'bookmarks', label: 'Bookmarks', icon: Star },
          { id: 'recent', label: 'Recent', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm border-r border-app-border transition-colors
              ${activeTab === tab.id 
                ? 'bg-app-bg text-app-text border-b-2 border-app-accent' 
                : 'text-app-muted hover:text-app-text hover:bg-app-border/50'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && renderFilesTab()}
        {activeTab === 'bookmarks' && renderBookmarksTab()}
        {activeTab === 'recent' && renderRecentTab()}
      </div>
    </div>
  );
};

// Plugin definition
export const FileExplorerPlugin = {
  id: 'file-explorer',
  name: 'Enhanced File Explorer',
  version: '1.0.0',
  description: 'An enhanced file explorer with bookmarks, recent files, and advanced search',
  author: 'Lokus Team',

  // Plugin activation
  activate() {
    console.log('🗂️ Activating File Explorer Plugin...');
    
    try {
      // Register the file explorer panel
      const panel = uiAPI.registerPanel('file-explorer', {
        id: 'enhanced-explorer',
        title: 'Enhanced Explorer',
        type: PANEL_TYPES.REACT,
        position: PANEL_POSITIONS.SIDEBAR_LEFT,
        component: FileExplorerPanel,
        icon: <FolderOpen className="w-4 h-4" />,
        initialSize: { width: 320, height: 600 },
        minSize: { width: 250, height: 400 },
        resizable: true,
        closable: true,
        visible: false, // Start hidden, user can show it
        order: 10,
        settings: {
          showHiddenFiles: false,
          sortBy: 'name',
          groupFolders: true
        }
      });

      // Register commands
      uiAPI.registerCommand('file-explorer', {
        id: 'toggle-enhanced-explorer',
        title: 'Toggle Enhanced File Explorer',
        category: 'View',
        handler: () => {
          uiAPI.togglePanel('file-explorer.enhanced-explorer');
        }
      });

      // Register context menu items
      uiAPI.registerContextMenu('file-explorer', {
        id: 'file-actions',
        target: '.obsidian-file-item',
        items: [
          {
            id: 'bookmark-file',
            label: 'Add to Bookmarks',
            icon: <Star className="w-4 h-4" />,
            action: (target) => {
              // Extract file info from target and add bookmark
              console.log('Adding file to bookmarks:', target);
            }
          }
        ]
      });

      // Register status bar item
      uiAPI.registerStatusBarItem('file-explorer', {
        id: 'explorer-status',
        text: 'Explorer Ready',
        tooltip: 'Enhanced File Explorer Status',
        alignment: 'left',
        priority: 90
      });

      console.log('✅ File Explorer Plugin activated successfully');
      return panel;
      
    } catch (error) {
      console.error('❌ Failed to activate File Explorer Plugin:', error);
      throw error;
    }
  },

  // Plugin deactivation
  deactivate() {
    console.log('🗂️ Deactivating File Explorer Plugin...');
    
    try {
      // Unregister all plugin contributions
      uiAPI.unregisterPlugin('file-explorer');
      
      console.log('✅ File Explorer Plugin deactivated successfully');
    } catch (error) {
      console.error('❌ Failed to deactivate File Explorer Plugin:', error);
      throw error;
    }
  }
};

export default FileExplorerPlugin;