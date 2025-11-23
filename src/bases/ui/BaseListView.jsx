import React from 'react';
import { File, Folder, Calendar, Tag, Paperclip } from 'lucide-react';
import { formatDate, formatFileSize } from '../../utils/formatters.js';

export default function BaseListView({
  data = [],
  onFileOpen,
  searchQuery = ''
}) {
  const getFileName = (path) => {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const handleItemClick = (item, event) => {
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

  const handleItemKeyDown = (item, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item, event);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden">
      <div className="divide-y divide-app-border">
        {data.map((item, index) => {
          const fileName = getFileName(item.path);
          const isDirectory = item.path?.endsWith('/');
          const tags = Array.isArray(item.properties?.tags) ? item.properties.tags : [];
          const size = item.size || item.properties?.size;
          const modified = item.modified || item.properties?.modified;

          return (
            <div
              key={item.path || index}
              onClick={(e) => handleItemClick(item, e)}
              onKeyDown={(e) => handleItemKeyDown(item, e)}
              tabIndex={0}
              className="px-6 py-3 hover:bg-app-accent/5 cursor-pointer transition-colors focus:outline-none focus:bg-app-accent/10"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isDirectory ? (
                    <Folder className="w-5 h-5 text-app-accent" />
                  ) : (
                    <File className="w-5 h-5 text-app-muted" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="text-sm font-medium text-app-text truncate mb-1">
                    {fileName}
                  </h3>

                  {/* Metadata row */}
                  <div className="flex items-center gap-4 text-xs text-app-muted">
                    {modified && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(modified)}</span>
                      </div>
                    )}
                    {size > 0 && (
                      <div className="flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        <span>{formatFileSize(size)}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Tag className="w-3 h-3 text-app-muted" />
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 text-xs bg-app-accent/10 text-app-accent rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom properties preview */}
                  {item.properties && Object.keys(item.properties).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {Object.entries(item.properties)
                        .filter(([key]) => !['tags', 'size', 'modified', 'created'].includes(key))
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <div key={key} className="flex items-center gap-1">
                            <span className="text-app-muted">{key}:</span>
                            <span className="text-app-text">
                              {Array.isArray(value) ? value.join(', ') : String(value).substring(0, 30)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
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