import React, { useState, useEffect, useMemo } from 'react';
import { Check, FolderOpen, Search, Target, Globe } from 'lucide-react';
import { useFolderScope } from '../contexts/FolderScopeContext';

export default function FolderSelector({
  fileTree,
  isOpen,
  onClose,
  onConfirm
}) {
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { scopeMode, scopedFolders, recentScopes, getAllFolders } = useFolderScope();

  const allFolders = useMemo(() => getAllFolders(fileTree), [fileTree, getAllFolders]);

  // Filter folders based on search
  const filteredFolders = useMemo(() => {
    if (!searchQuery) return allFolders;

    const query = searchQuery.toLowerCase();
    return allFolders.filter(folder =>
      folder.name.toLowerCase().includes(query) ||
      folder.relativePath.toLowerCase().includes(query)
    );
  }, [allFolders, searchQuery]);

  // Initialize with current scope
  useEffect(() => {
    if (isOpen) {
      setSelectedFolders([...scopedFolders]);
      setSearchQuery('');
    }
  }, [isOpen, scopedFolders]);

  const handleFolderToggle = (folderPath) => {
    setSelectedFolders(prev =>
      prev.includes(folderPath)
        ? prev.filter(p => p !== folderPath)
        : [...prev, folderPath]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedFolders);
  };

  const handleUseRecentScope = (scope) => {
    setSelectedFolders([...scope]);
  };

  const getFolderDisplayName = (folder) => {
    if (folder.depth === 0) return folder.name;
    return folder.relativePath;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-panel border border-app-border rounded-lg w-[600px] max-h-[500px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text mb-2">
            Switch to Local View
          </h2>
          <p className="text-sm text-app-muted">
            Select one or more folders to focus on. Only files within selected folders will be shown.
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-app-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-4 py-2 text-app-text placeholder-app-muted focus:border-app-accent focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredFolders.length === 0 ? (
            <div className="text-center py-8 text-app-muted">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No folders found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFolders.map((folder) => {
                const isSelected = selectedFolders.includes(folder.path);
                const indent = Math.min(folder.depth, 3) * 16;

                return (
                  <label
                    key={folder.path}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-app-bg cursor-pointer group"
                    style={{ paddingLeft: `${12 + indent}px` }}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-app-accent border-app-accent'
                        : 'border-app-border group-hover:border-app-accent'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>

                    <FolderOpen className="w-4 h-4 text-app-accent flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <span className="text-app-text text-sm truncate">
                        {getFolderDisplayName(folder)}
                      </span>
                      {folder.depth > 0 && (
                        <div className="text-xs text-app-muted truncate">
                          {folder.path}
                        </div>
                      )}
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleFolderToggle(folder.path)}
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent - Compact */}
        {recentScopes.length > 0 && (
          <div className="px-4 py-2 border-t border-app-border bg-app-bg/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-app-muted">Recent:</span>
              {recentScopes.map((scope, index) => {
                const folderNames = scope.map(path => path.split('/').pop()).join(', ');
                const isCurrentScope = JSON.stringify(scope.sort()) === JSON.stringify(scopedFolders.sort());

                return (
                  <button
                    key={index}
                    onClick={() => handleUseRecentScope(scope)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      isCurrentScope
                        ? 'bg-app-accent/20 text-app-accent'
                        : 'bg-app-panel hover:bg-app-border text-app-text'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{folderNames}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-app-border flex items-center justify-between">
          <div className="text-sm text-app-muted">
            {selectedFolders.length > 0 ? (
              `${selectedFolders.length} folder${selectedFolders.length === 1 ? '' : 's'} selected`
            ) : (
              'No folders selected'
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedFolders([]);
                onConfirm([]);
              }}
              className="px-4 py-2 text-app-muted hover:text-app-text transition-colors"
            >
              <Globe className="w-4 h-4 inline mr-2" />
              Global View
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-app-bg hover:bg-app-border text-app-text rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirm}
              disabled={selectedFolders.length === 0}
              className="px-4 py-2 bg-app-accent hover:bg-app-accent/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Local View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}