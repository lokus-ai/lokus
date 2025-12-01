import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, FileDown, Package, Download, Settings, Eye, Loader2 } from 'lucide-react';
import exportManager from '../../../core/export/export-manager.js';

export default function ExportModal({
  isOpen,
  onClose,
  htmlContent,
  currentFile,
  workspacePath,
  exportType = 'single' // 'single', 'folder', 'batch'
}) {
  const [format, setFormat] = useState('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState('');
  const [options, setOptions] = useState({
    preserveWikiLinks: true,
    includeMetadata: true,
    embedImages: false,
    pageSize: 'a4',
    orientation: 'portrait',
  });

  const modalRef = useRef(null);

  // Load preview when showing
  useEffect(() => {
    if (showPreview && format === 'markdown' && htmlContent) {
      const markdownPreview = exportManager.previewMarkdown(htmlContent, {
        preserveWikiLinks: options.preserveWikiLinks,
        includeMetadata: options.includeMetadata,
        metadata: getMetadata(),
      });
      setPreview(markdownPreview);
    }
  }, [showPreview, format, htmlContent, options]);

  const getMetadata = () => {
    if (!currentFile) return {};

    return {
      title: currentFile.name || 'Untitled',
      created: currentFile.created || new Date().toISOString(),
      modified: currentFile.modified || new Date().toISOString(),
      tags: currentFile.tags || [],
    };
  };

  const handleExport = async () => {
    if (!htmlContent && exportType === 'single') {
      alert('No content to export');
      return;
    }

    setIsExporting(true);

    try {
      let result;
      const filename = currentFile?.name || 'export';

      if (exportType === 'single') {
        if (format === 'markdown') {
          result = await exportManager.exportToMarkdown({
            htmlContent,
            filename: `${filename}.md`,
            metadata: options.includeMetadata ? getMetadata() : {},
            preserveWikiLinks: options.preserveWikiLinks,
            includeMetadata: options.includeMetadata,
          });
        } else if (format === 'pdf') {
          result = await exportManager.exportToPDF({
            htmlContent,
            filename: `${filename}.pdf`,
            metadata: getMetadata(),
            pageSize: options.pageSize,
            orientation: options.orientation,
          });
        }

        if (result) {
          await exportManager.download(result.blob, result.filename);
        }
      } else if (exportType === 'folder') {
        result = await exportManager.exportFolder({
          folderPath: currentFile?.path,
          workspacePath,
          format,
          includeSubfolders: true,
        });

        if (result) {
          await exportManager.download(result.blob, result.filename);
        }
      }

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-3xl mx-4 bg-app-panel backdrop-blur-md border border-app-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-app-border">
          <div className="flex items-center gap-3">
            <FileDown className="w-6 h-6 text-app-accent" />
            <h2 className="text-xl font-semibold text-app-text">
              Export {exportType === 'folder' ? 'Folder' : 'Note'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-app-bg transition-colors"
          >
            <X className="w-5 h-5 text-app-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-app-text flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('markdown')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  format === 'markdown'
                    ? 'border-app-accent bg-app-accent/10 text-app-text'
                    : 'border-app-border hover:border-app-accent/50 text-app-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Markdown</div>
                    <div className="text-xs opacity-70">Clean .md format</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setFormat('pdf')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  format === 'pdf'
                    ? 'border-app-accent bg-app-accent/10 text-app-text'
                    : 'border-app-border hover:border-app-accent/50 text-app-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileDown className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">PDF</div>
                    <div className="text-xs opacity-70">Portable document</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-app-text flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Options
            </label>

            <div className="space-y-2">
              {format === 'markdown' && (
                <>
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-app-bg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.preserveWikiLinks}
                      onChange={(e) => setOptions({ ...options, preserveWikiLinks: e.target.checked })}
                      className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-app-text">Preserve Wiki Links</div>
                      <div className="text-xs text-app-muted">Keep [[links]] format instead of markdown links</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-app-bg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeMetadata}
                      onChange={(e) => setOptions({ ...options, includeMetadata: e.target.checked })}
                      className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-app-text">Include Frontmatter</div>
                      <div className="text-xs text-app-muted">Add YAML metadata at the top of the file</div>
                    </div>
                  </label>
                </>
              )}

              {format === 'pdf' && (
                <>
                  <div className="p-3 rounded-lg bg-app-bg space-y-3">
                    <label className="block">
                      <span className="text-sm font-medium text-app-text">Page Size</span>
                      <select
                        value={options.pageSize}
                        onChange={(e) => setOptions({ ...options, pageSize: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 bg-app-panel border border-app-border rounded-md text-app-text focus:outline-none focus:ring-2 focus:ring-app-accent"
                      >
                        <option value="a4">A4</option>
                        <option value="letter">Letter</option>
                        <option value="legal">Legal</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-app-text">Orientation</span>
                      <select
                        value={options.orientation}
                        onChange={(e) => setOptions({ ...options, orientation: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 bg-app-panel border border-app-border rounded-md text-app-text focus:outline-none focus:ring-2 focus:ring-app-accent"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-app-bg cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.embedImages}
                  onChange={(e) => setOptions({ ...options, embedImages: e.target.checked })}
                  className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-app-text">Embed Images</div>
                  <div className="text-xs text-app-muted">Convert images to base64 (increases file size)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Preview */}
          {format === 'markdown' && (
            <div className="space-y-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm font-medium text-app-accent hover:text-app-accent/80"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>

              {showPreview && (
                <div className="p-4 bg-app-bg rounded-lg border border-app-border">
                  <pre className="text-xs text-app-text whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {preview}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Export Info */}
          {currentFile && (
            <div className="p-4 bg-app-bg rounded-lg border border-app-border">
              <div className="text-sm text-app-muted space-y-1">
                <div><span className="font-medium">File:</span> {currentFile.name}</div>
                {currentFile.path && <div><span className="font-medium">Path:</span> {currentFile.path}</div>}
                {exportType === 'folder' && (
                  <div className="text-xs mt-2 text-app-muted/70">
                    All markdown files in this folder will be exported to a ZIP archive
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-app-border bg-app-bg">
          <div className="text-sm text-app-muted">
            {exportType === 'folder' ? 'Export all files in folder' : 'Export current note'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-app-text hover:bg-app-panel transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-6 py-2 rounded-lg bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
