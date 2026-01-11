import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Link as LinkIcon, Upload, X, ExternalLink } from 'lucide-react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

export default function ImageInsertModal({
  isOpen,
  onClose,
  onInsert,
  workspacePath
}) {
  const [mode, setMode] = useState('url'); // 'url' or 'file'
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [altText, setAltText] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const urlInputRef = useRef(null);
  const modalRef = useRef(null);

  // Load workspace images when modal opens in file mode
  useEffect(() => {
    if (isOpen && mode === 'file' && workspacePath) {
      loadWorkspaceImages();
    }
  }, [isOpen, mode, workspacePath]);

  // Focus URL input when modal opens
  useEffect(() => {
    if (isOpen && mode === 'url' && urlInputRef.current) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  // Update preview when URL or file changes
  useEffect(() => {
    if (mode === 'url' && imageUrl) {
      handleUrlPreview(imageUrl);
    } else if (mode === 'file' && selectedFile) {
      setPreviewSrc(selectedFile);
      setPreviewError('');
    } else {
      setPreviewSrc('');
      setPreviewError('');
    }
  }, [imageUrl, selectedFile, mode]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleInsert();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, imageUrl, selectedFile, altText]);

  const loadWorkspaceImages = async () => {
    setIsLoadingFiles(true);
    try {
      const files = await invoke('find_workspace_images', { workspacePath });
      setImageFiles(files || []);
    } catch (error) {
      setImageFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleUrlPreview = (url) => {
    if (!url || !url.trim()) {
      setPreviewSrc('');
      setPreviewError('');
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError('');

    // Simple URL validation
    try {
      new URL(url);
      setPreviewSrc(url);
      setIsLoadingPreview(false);
    } catch {
      setPreviewError('Invalid URL');
      setPreviewSrc('');
      setIsLoadingPreview(false);
    }
  };

  const handleInsert = () => {
    // For workspace files, convert to asset URL that Tauri can load
    const src = mode === 'url' ? imageUrl : convertFileSrc(selectedFile);

    if (!src || (mode === 'url' && !src.trim())) {
      return;
    }

    onInsert({
      src,
      alt: altText || 'Image',
    });

    // Reset and close
    setImageUrl('');
    setSelectedFile(null);
    setAltText('');
    setPreviewSrc('');
    setPreviewError('');
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  const handleFileSelect = (filePath) => {
    setSelectedFile(filePath);
    if (!altText) {
      // Auto-fill alt text from filename
      const fileName = filePath.split('/').pop().replace(/\.[^/.]+$/, '');
      setAltText(fileName);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-3xl mx-4 bg-app-panel border border-app-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-app-accent" />
            <h2 className="text-lg font-semibold text-app-text">Insert Image</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-app-hover transition-colors"
          >
            <X className="w-5 h-5 text-app-muted" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-app-border bg-app-bg">
          <button
            onClick={() => setMode('url')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'url'
                ? 'text-app-accent border-b-2 border-app-accent bg-app-panel'
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            Image URL
          </button>
          <button
            onClick={() => setMode('file')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'file'
                ? 'text-app-accent border-b-2 border-app-accent bg-app-panel'
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <Upload className="w-4 h-4" />
            Workspace File
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {mode === 'url' ? (
            <>
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  Image URL
                </label>
                <input
                  ref={urlInputRef}
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                />
              </div>

              {/* Alt Text */}
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  Alt Text (optional)
                </label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                />
              </div>

              {/* Preview */}
              {previewSrc && (
                <div className="border border-app-border rounded-lg p-4 bg-app-bg">
                  <p className="text-sm font-medium text-app-text mb-2">Preview</p>
                  <div className="flex justify-center items-center bg-app-panel rounded-lg overflow-hidden">
                    <img
                      src={previewSrc}
                      alt="Preview"
                      className="max-w-full max-h-64 object-contain"
                      onError={() => setPreviewError('Failed to load image')}
                    />
                  </div>
                </div>
              )}

              {previewError && (
                <div className="text-sm text-red-500">
                  {previewError}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Workspace Images */}
              <div>
                <p className="text-sm font-medium text-app-text mb-3">
                  Select an image from your workspace
                </p>

                {isLoadingFiles ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-app-border border-t-app-accent rounded-full animate-spin" />
                  </div>
                ) : imageFiles.length === 0 ? (
                  <div className="text-center py-8 text-app-muted">
                    No images found in workspace
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxHeight: '256px', overflowY: 'auto', padding: '8px' }}>
                    {imageFiles.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => handleFileSelect(file)}
                        style={{ aspectRatio: '1/1', position: 'relative' }}
                        className={`rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedFile === file
                            ? 'border-app-accent ring-2 ring-app-accent'
                            : 'border-app-border hover:border-app-accent/50'
                        }`}
                      >
                        <img
                          src={convertFileSrc(file)}
                          alt={file.split('/').pop()}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {selectedFile === file && (
                          <div className="absolute inset-0 bg-app-accent/20 flex items-center justify-center">
                            <div className="w-6 h-6 bg-app-accent rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Alt Text */}
              {selectedFile && (
                <div>
                  <label className="block text-sm font-medium text-app-text mb-2">
                    Alt Text
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Describe the image"
                    className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
                  />
                </div>
              )}

              {/* Selected File Preview */}
              {previewSrc && (
                <div className="border border-app-border rounded-lg p-4 bg-app-bg">
                  <p className="text-sm font-medium text-app-text mb-2">Preview</p>
                  <div className="flex justify-center items-center bg-app-panel rounded-lg overflow-hidden">
                    <img
                      src={convertFileSrc(previewSrc)}
                      alt="Preview"
                      className="max-w-full max-h-64 object-contain"
                    />
                  </div>
                  <p className="text-xs text-app-muted mt-2 truncate">
                    {previewSrc}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-app-border bg-app-bg">
          <div className="text-xs text-app-muted">
            <span className="font-medium">⌘+Enter</span> to insert • <span className="font-medium">Esc</span> to cancel
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-app-muted hover:text-app-text border border-app-border rounded-lg hover:bg-app-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!imageUrl && !selectedFile}
              className="px-4 py-2 text-sm font-medium text-white bg-app-accent rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
