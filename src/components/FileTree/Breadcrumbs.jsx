import React from 'react';
import { ChevronRight, Folder, FileText } from 'lucide-react';

export default function Breadcrumbs({ activeFile, workspacePath, onNavigate }) {
  if (!activeFile) return null;

  // Get the relative path from workspace
  const relativePath = activeFile.replace(workspacePath, '').replace(/^\/+/, '');
  const pathParts = relativePath.split('/');

  // Build breadcrumb segments
  const breadcrumbs = pathParts.map((part, index) => {
    // Build the full path up to this segment
    const segmentPath = workspacePath + '/' + pathParts.slice(0, index + 1).join('/');
    const isLast = index === pathParts.length - 1;
    const isFile = isLast; // Last segment is the file

    return {
      label: part,
      path: segmentPath,
      isFile,
      isLast
    };
  });

  return (
    <div className="breadcrumbs-container flex items-center px-4 py-2 bg-[var(--background-primary)] border-b border-[var(--border-color)] overflow-x-auto">
      {/* Workspace root */}
      <button
        onClick={() => onNavigate(workspacePath)}
        className="breadcrumb-item flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--background-secondary)] text-[var(--text-secondary)] transition-colors"
        title="Workspace root"
      >
        <Folder size={14} />
        <span className="text-xs font-medium">Workspace</span>
      </button>

      {/* Path segments */}
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="text-[var(--text-muted)] mx-1" />
          <button
            onClick={() => !crumb.isFile && onNavigate(crumb.path)}
            disabled={crumb.isFile}
            className={`breadcrumb-item flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
              crumb.isLast
                ? 'text-[var(--text-primary)] font-medium cursor-default'
                : 'text-[var(--text-secondary)] hover:bg-[var(--background-secondary)] cursor-pointer'
            }`}
            title={crumb.isFile ? 'Current file' : 'Click to navigate'}
          >
            {crumb.isFile ? (
              <FileText size={14} />
            ) : (
              <Folder size={14} />
            )}
            <span>{crumb.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
