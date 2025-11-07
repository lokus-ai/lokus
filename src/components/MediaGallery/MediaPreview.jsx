import React from 'react';
import { X, Download, Trash2, ScanLine, Link } from 'lucide-react';
import './MediaPreview.css';

const MediaPreview = ({ media, suggestions, onClose, onDelete, onOCR }) => {
  if (!media) return null;

  return (
    <div className="media-preview-overlay" onClick={onClose}>
      <div className="media-preview-content" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>{media.name}</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="preview-body">
          {media.mediaType === 'Image' ? (
            <img src={`file://${media.path}`} alt={media.name} />
          ) : media.mediaType === 'Pdf' ? (
            <div className="pdf-preview">
              <iframe src={`file://${media.path}`} title={media.name} />
            </div>
          ) : (
            <div className="file-preview">
              <p>Preview not available for {media.mediaType} files</p>
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="suggestions-panel">
              <h4>Related Documents</h4>
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="suggestion-item">
                  <Link size={14} />
                  <span>{suggestion.file}</span>
                  <span className="confidence">{Math.round(suggestion.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="preview-footer">
          {media.mediaType === 'Image' && (
            <button onClick={onOCR}>
              <ScanLine size={16} />
              Extract Text
            </button>
          )}
          <button onClick={() => window.open(`file://${media.path}`, '_blank')}>
            <Download size={16} />
            Open External
          </button>
          <button className="danger" onClick={onDelete}>
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaPreview;