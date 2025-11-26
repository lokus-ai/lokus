import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Breadcrumbs - Clickable navigation showing current file path
 *
 * Displays breadcrumb navigation like:
 * Workspace > folder1 > folder2 > file.md
 *
 * - All folders are clickable
 * - Current file is shown but not clickable
 * - Automatically scrolls horizontally for long paths
 *
 * @param {string} activeFile - Full path to currently selected file
 * @param {string} workspacePath - Full path to workspace root
 * @param {Function} onNavigate - Callback when clicking a folder
 */
export default function Breadcrumbs({ activeFile, workspacePath, onNavigate }) {
  const segments = useMemo(() => {
    if (!activeFile || !workspacePath) return [];

    // Get relative path from workspace root
    const relativePath = activeFile.replace(workspacePath + '/', '');
    const parts = relativePath.split('/');

    // Build cumulative paths for each segment
    let cumPath = workspacePath;
    return parts.map((part, index) => {
      if (index < parts.length - 1) {
        // This is a folder
        cumPath = cumPath + '/' + part;
        return { name: part, path: cumPath, isFolder: true };
      } else {
        // This is the final file
        return { name: part, path: activeFile, isFolder: false };
      }
    });
  }, [activeFile, workspacePath]);

  if (segments.length === 0) return null;

  return (
    <div className="breadcrumb-container">
      <button
        onClick={() => onNavigate(workspacePath)}
        className="breadcrumb-segment"
        type="button"
      >
        Workspace
      </button>

      {segments.map((segment) => (
        <React.Fragment key={segment.path}>
          <ChevronRight className="breadcrumb-separator" size={14} />
          <button
            onClick={() => segment.isFolder && onNavigate(segment.path)}
            className={cn(
              "breadcrumb-segment",
              !segment.isFolder && "breadcrumb-file"
            )}
            disabled={!segment.isFolder}
            type="button"
          >
            {segment.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
