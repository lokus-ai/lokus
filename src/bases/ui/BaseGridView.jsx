import React from 'react';
import { File, Folder, Calendar, Tag, Paperclip, ExternalLink } from 'lucide-react';
import { formatDate, formatFileSize } from '../../utils/formatters.js';

export default function BaseGridView({
  data = [],
  onFileOpen,
  searchQuery = ''
}) {
  const getFileName = (path) => {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const handleCardClick = (item, event) => {
    if (!onFileOpen) return;

    const fileName = item.path.split('/').pop();
    const fileObject = {
      path: item.path,
      name: fileName,
      is_directory: item.path?.endsWith('/')
    };

    if (event.metaKey || event.ctrlKey) {
      window.open(`#/file/${encodeURIComponent(item.path)}`, '_blank');
    } else {
      onFileOpen(fileObject);
    }
  };

  const handleCardKeyDown = (item, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick(item, event);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((item, index) => {
          const fileName = getFileName(item.path);
          const isDirectory = item.path?.endsWith('/');
          const tags = item.properties?.tags || [];
          const size = item.size || item.properties?.size;
          const modified = item.modified || item.properties?.modified;

          return (
            <div
              key={item.path || index}
              onClick={(e) => handleCardClick(item, e)}
              onKeyDown={(e) => handleCardKeyDown(item, e)}
              tabIndex={0}
              className="group relative flex flex-col bg-app-surface border border-app-border rounded-lg p-4 hover:border-app-accent hover:shadow-lg cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              {/* Icon & External Link */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-shrink-0">
                  {isDirectory ? (
                    <Folder className="w-8 h-8 text-app-accent" />
                  ) : (
                    <File className="w-8 h-8 text-app-muted" />
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-app-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Title */}
              <h3 className="text-sm font-medium text-app-text mb-2 line-clamp-2 min-h-[2.5rem]">
                {fileName}
              </h3>

              {/* Metadata */}
              <div className="flex-1 space-y-2 text-xs text-app-muted mb-3">
                {modified && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{formatDate(modified)}</span>
                  </div>
                )}
                {size > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3 flex-shrink-0" />
                    <span>{formatFileSize(size)}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 text-xs bg-app-accent/10 text-app-accent rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {tags.length > 3 && (
                    <span className="px-1.5 py-0.5 text-xs text-app-muted">
                      +{tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Custom properties preview */}
              {item.properties && Object.keys(item.properties).length > 0 && (
                <div className="pt-2 border-t border-app-border/50">
                  {Object.entries(item.properties)
                    .filter(([key]) => !['tags', 'size', 'modified', 'created'].includes(key))
                    .slice(0, 2)
                    .map(([key, value]) => (
                      <div key={key} className="text-xs mb-1 last:mb-0">
                        <span className="text-app-muted">{key}: </span>
                        <span className="text-app-text">
                          {Array.isArray(value)
                            ? value.slice(0, 2).join(', ') + (value.length > 2 ? '...' : '')
                            : String(value).substring(0, 25) + (String(value).length > 25 ? '...' : '')}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <File className="w-12 h-12 mx-auto mb-3 text-app-muted opacity-50" />
            <p className="text-app-muted">
              {searchQuery ? 'No files match your search' : 'No files to display'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}