import React, { useState, useRef } from 'react';
import { Upload, X, File } from 'lucide-react';
import './MediaUploader.css';

const MediaUploader = ({ workspace, onUpload, onClose }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const fileArray = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      path: file.path || file.name  // Electron provides file.path
    }));
    setSelectedFiles(prev => [...prev, ...fileArray]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="media-uploader-overlay" onClick={onClose}>
      <div className="media-uploader-content" onClick={(e) => e.stopPropagation()}>
        <div className="uploader-header">
          <h3>Upload Media Files</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="uploader-body">
          <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleChange}
              accept="image/*,application/pdf,video/*,audio/*"
              style={{ display: 'none' }}
            />

            <label
              htmlFor="input-file-upload"
              className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
            >
              <div>
                <Upload size={40} />
                <p>Drag and drop files here or</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="upload-button"
                >
                  Browse Files
                </button>
                <p className="file-types">
                  Supports: Images, PDFs, Videos, Audio
                </p>
              </div>
            </label>

            {dragActive && (
              <div
                className="drag-file-element"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />
            )}
          </form>

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h4>Selected Files ({selectedFiles.length})</h4>
              <div className="file-list">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <File size={16} />
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <button onClick={() => removeFile(index)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="uploader-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="upload-button primary"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0}
          >
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaUploader;