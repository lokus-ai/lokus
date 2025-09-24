/**
 * Common cross-platform functionality
 * 
 * This module contains shared code that works across all platforms
 */

// Common file operations
export const fileOperations = {
  // Get file extension
  getExtension: (filename) => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
  },
  
  // Check if file is markdown
  isMarkdown: (filename) => {
    const ext = fileOperations.getExtension(filename);
    return ['md', 'markdown', 'mdown', 'mkd', 'mdwn'].includes(ext);
  },
  
  // Check if file is an image
  isImage: (filename) => {
    const ext = fileOperations.getExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
  },
  
  // Get file basename without extension
  getBasename: (filename) => {
    const lastDot = filename.lastIndexOf('.');
    const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
    const start = lastSlash + 1;
    const end = lastDot > start ? lastDot : filename.length;
    return filename.slice(start, end);
  }
};

// Common keyboard utilities
export const keyboardUtils = {
  // Check if a modifier key is pressed
  isModifierPressed: (event) => {
    return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  },
  
  // Get a normalized key string
  getNormalizedKey: (event) => {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    
    // Normalize the key
    let key = event.key;
    if (key === ' ') key = 'Space';
    if (key === 'ArrowLeft') key = 'Left';
    if (key === 'ArrowRight') key = 'Right';
    if (key === 'ArrowUp') key = 'Up';
    if (key === 'ArrowDown') key = 'Down';
    
    if (key.length === 1) {
      key = key.toUpperCase();
    }
    
    parts.push(key);
    return parts.join('+');
  }
};

// Common UI utilities
export const uiUtils = {
  // Format file size
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  },
  
  // Format date
  formatDate: (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes === 0 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString();
    }
  }
};

// Common validation utilities
export const validationUtils = {
  // Validate filename
  isValidFilename: (filename) => {
    // Common invalid characters across platforms
    const invalidChars = /[<>:"|?*]/;
    return !invalidChars.test(filename) && filename.trim().length > 0;
  },
  
  // Validate folder name
  isValidFoldername: (foldername) => {
    return validationUtils.isValidFilename(foldername) && 
           !foldername.startsWith('.') && 
           foldername !== '..' && 
           foldername !== '.';
  }
};