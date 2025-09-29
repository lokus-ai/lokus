import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const FolderScopeContext = createContext();

export function FolderScopeProvider({ children, workspacePath }) {
  const [scopeMode, setScopeMode] = useState('global'); // 'global' or 'local'
  const [scopedFolders, setScopedFolders] = useState([]); // Array of folder paths
  const [recentScopes, setRecentScopes] = useState([]); // Recently used folder combinations

  // Load persisted scope settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lokus-folder-scope');
      if (saved) {
        const { recentScopes: savedRecent } = JSON.parse(saved);
        if (savedRecent) setRecentScopes(savedRecent);
      }
    } catch (error) {
      // Ignore errors
    }
  }, []);

  // Save scope settings
  const saveSettings = useCallback((newRecentScopes) => {
    try {
      localStorage.setItem('lokus-folder-scope', JSON.stringify({
        recentScopes: newRecentScopes
      }));
    } catch (error) {
      // Ignore errors
    }
  }, []);

  const setGlobalScope = useCallback(() => {
    setScopeMode('global');
    setScopedFolders([]);
  }, []);

  const setLocalScope = useCallback((folderPaths) => {
    const folders = Array.isArray(folderPaths) ? folderPaths : [folderPaths];
    setScopeMode('local');
    setScopedFolders(folders);

    // Add to recent scopes (avoid duplicates)
    const newRecentScopes = [folders, ...recentScopes.filter(scope =>
      JSON.stringify(scope.sort()) !== JSON.stringify(folders.sort())
    )].slice(0, 5); // Keep only last 5

    setRecentScopes(newRecentScopes);
    saveSettings(newRecentScopes);
  }, [recentScopes, saveSettings]);

  const toggleScope = useCallback(() => {
    if (scopeMode === 'global') {
      // Can't switch to local without selecting folders first
      return;
    } else {
      setGlobalScope();
    }
  }, [scopeMode, setGlobalScope]);

  // Get all folders from file tree (recursive)
  const getAllFolders = useCallback((fileTree) => {
    const folders = [];

    const walkTree = (entries, parentPath = '') => {
      for (const entry of entries) {
        if (entry.is_directory) {
          const folderPath = entry.path;
          const folderName = entry.name;
          const relativePath = parentPath ? `${parentPath}/${folderName}` : folderName;

          folders.push({
            path: folderPath,
            name: folderName,
            relativePath: relativePath,
            depth: relativePath.split('/').length - 1
          });

          if (entry.children) {
            walkTree(entry.children, relativePath);
          }
        }
      }
    };

    walkTree(fileTree);
    return folders;
  }, []);

  // Filter file tree based on scope
  const filterFileTree = useCallback((fileTree) => {
    if (scopeMode === 'global' || scopedFolders.length === 0) {
      return fileTree;
    }

    // Build filtered tree by including only files/folders within scope
    const isPathInScope = (path) => {
      return scopedFolders.some(scopePath =>
        path === scopePath || path.startsWith(scopePath + '/')
      );
    };

    const filterEntries = (entries) => {
      const filtered = [];

      for (const entry of entries) {
        if (isPathInScope(entry.path)) {
          if (entry.is_directory && entry.children) {
            // For scoped folders, show their complete contents
            if (scopedFolders.includes(entry.path)) {
              filtered.push(entry);
            } else {
              // For parent folders of scoped content, filter recursively
              const filteredChildren = filterEntries(entry.children);
              if (filteredChildren.length > 0) {
                filtered.push({
                  ...entry,
                  children: filteredChildren
                });
              }
            }
          } else {
            // Regular file
            filtered.push(entry);
          }
        }
      }

      return filtered;
    };

    // Special case: if we're scoping to root folders, return them directly
    const rootScopedFolders = fileTree.filter(entry =>
      entry.is_directory && scopedFolders.includes(entry.path)
    );

    if (rootScopedFolders.length > 0) {
      return rootScopedFolders;
    }

    return filterEntries(fileTree);
  }, [scopeMode, scopedFolders]);

  // Check if a file path is within current scope
  const isFileInScope = useCallback((filePath) => {
    if (scopeMode === 'global' || scopedFolders.length === 0) {
      return true;
    }

    return scopedFolders.some(scopePath =>
      filePath === scopePath || filePath.startsWith(scopePath + '/')
    );
  }, [scopeMode, scopedFolders]);

  // Get scope status for display
  const getScopeStatus = useCallback(() => {
    if (scopeMode === 'global') {
      return { mode: 'global', description: 'Global - All Files' };
    }

    if (scopedFolders.length === 1) {
      const folderName = scopedFolders[0].split('/').pop();
      return {
        mode: 'local',
        description: `Local - ${folderName}`,
        folders: scopedFolders
      };
    }

    return {
      mode: 'local',
      description: `Local - ${scopedFolders.length} folders`,
      folders: scopedFolders
    };
  }, [scopeMode, scopedFolders]);

  const contextValue = {
    scopeMode,
    scopedFolders,
    recentScopes,
    workspacePath,
    setGlobalScope,
    setLocalScope,
    toggleScope,
    getAllFolders,
    filterFileTree,
    isFileInScope,
    getScopeStatus
  };

  return (
    <FolderScopeContext.Provider value={contextValue}>
      {children}
    </FolderScopeContext.Provider>
  );
}

export function useFolderScope() {
  const context = useContext(FolderScopeContext);
  if (!context) {
    throw new Error('useFolderScope must be used within a FolderScopeProvider');
  }
  return context;
}