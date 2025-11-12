import React, { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon } from 'lucide-react';
import { readFile } from '@tauri-apps/plugin-fs';
import { imageDataToDataURL } from '../../utils/mimeTypes.js';
import './ImagePicker.css';

const ImagePicker = ({ isOpen, onClose, onSelect, workspacePath }) => {
  const [images, setImages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => {
    if (isOpen && workspacePath) {
      loadImages();
    }
  }, [isOpen, workspacePath]);

  const loadImages = async () => {
    try {
      setLoading(true);

      // Use the global file index that's already loaded
      const fileIndex = window.__LOKUS_FILE_INDEX__ || [];

      // Filter for image files
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
      const imageFiles = fileIndex
        .filter(file => {
          if (!file || !file.path) return false;
          return imageExtensions.some(ext => file.path.toLowerCase().endsWith(ext));
        })
        .map(file => ({
          path: file.path,
          name: file.path.split('/').pop(),
          relativePath: file.path.replace(workspacePath + '/', '')
        }));

      setImages(imageFiles);
      setLoading(false);

      // Load thumbnails in background
      imageFiles.forEach(loadThumbnail);
    } catch (err) {
      console.error('[ImagePicker] Failed to load images:', err);
      setLoading(false);
    }
  };

  const loadThumbnail = async (image) => {
    try {
      const imageData = await readFile(image.path);
      const dataUrl = imageDataToDataURL(imageData, image.path);
      setThumbnails(prev => ({ ...prev, [image.path]: dataUrl }));
    } catch (err) {
      // Silently fail for individual thumbnails
    }
  };

  const handleSelect = async (image) => {
    try {
      // If we already have the thumbnail, use it
      if (thumbnails[image.path]) {
        onSelect({
          src: thumbnails[image.path],
          alt: image.name,
          path: image.path
        });
      } else {
        // Otherwise load it now
        const imageData = await readFile(image.path);
        const dataUrl = imageDataToDataURL(imageData, image.path);

        onSelect({
          src: dataUrl,
          alt: image.name,
          path: image.path
        });
      }
      onClose();
    } catch (err) {
      // Error selecting image - user feedback could be added here
    }
  };

  const filteredImages = images.filter(img =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="image-picker-overlay" onClick={onClose}>
      <div className="image-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="image-picker-header">
          <h2>Insert Image</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close image picker">
            <X size={20} />
          </button>
        </div>

        <div className="image-picker-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="image-picker-content">
          {loading ? (
            <div className="image-picker-loading">
              <div className="spinner"></div>
              <p>Loading images...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="image-picker-empty">
              <ImageIcon size={48} />
              <p>No images found</p>
            </div>
          ) : (
            <div className="image-grid">
              {filteredImages.map((image) => (
                <div
                  key={image.path}
                  className="image-grid-item"
                  onClick={() => handleSelect(image)}
                >
                  <div className="image-thumbnail">
                    {thumbnails[image.path] ? (
                      <img src={thumbnails[image.path]} alt={image.name} />
                    ) : (
                      <div className="thumbnail-loading">
                        <ImageIcon size={32} />
                      </div>
                    )}
                  </div>
                  <div className="image-name">{image.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePicker;
