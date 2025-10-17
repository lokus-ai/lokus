/**
 * Export Manager
 * Coordinates exports to different formats (Markdown, PDF, ZIP)
 */

import markdownExporter from './markdown-exporter.js';
import pdfExporter from './pdf-exporter.js';
import JSZip from 'jszip';

export class ExportManager {
  constructor() {
    this.markdownExporter = markdownExporter;
    this.pdfExporter = pdfExporter;
  }

  /**
   * Export a single note to Markdown
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} Markdown blob
   */
  async exportToMarkdown(options = {}) {
    const {
      htmlContent,
      filename = 'export.md',
      metadata = {},
      preserveWikiLinks = true,
      includeMetadata = true,
    } = options;

    if (!htmlContent) {
      throw new Error('HTML content is required for export');
    }

    // Convert to markdown
    const markdown = this.markdownExporter.export(htmlContent, {
      preserveWikiLinks,
      includeMetadata,
      metadata,
    });

    // Create blob
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });

    return { blob, filename };
  }

  /**
   * Export a single note to PDF
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} PDF blob
   */
  async exportToPDF(options = {}) {
    const {
      htmlContent,
      filename = 'export.pdf',
      metadata = {},
      pageSize = 'a4',
      orientation = 'portrait',
      method = 'canvas', // 'canvas' or 'text'
    } = options;

    if (!htmlContent) {
      throw new Error('HTML content is required for export');
    }

    // Convert to PDF
    let blob;
    if (method === 'text') {
      blob = await this.pdfExporter.exportWithText(htmlContent, {
        metadata,
        pageSize,
        orientation,
      });
    } else {
      blob = await this.pdfExporter.export(htmlContent, {
        metadata,
        pageSize,
        orientation,
      });
    }

    return { blob, filename };
  }

  /**
   * Export multiple files to a ZIP archive
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} ZIP blob
   */
  async exportToZip(options = {}) {
    const {
      files = [],
      format = 'markdown', // 'markdown' or 'pdf'
      filename = 'export.zip',
      preserveStructure = true,
    } = options;

    if (!files || files.length === 0) {
      throw new Error('At least one file is required for ZIP export');
    }

    const zip = new JSZip();

    // Process each file
    for (let file of files) {
      const { path, htmlContent, metadata } = file;

      let blob;
      let fileExtension;

      if (format === 'markdown') {
        const result = await this.exportToMarkdown({
          htmlContent,
          metadata,
          preserveWikiLinks: true,
          includeMetadata: true,
        });
        blob = result.blob;
        fileExtension = '.md';
      } else if (format === 'pdf') {
        const result = await this.exportToPDF({
          htmlContent,
          metadata,
        });
        blob = result.blob;
        fileExtension = '.pdf';
      }

      // Determine file path in ZIP
      let zipPath;
      if (preserveStructure && path) {
        // Preserve folder structure
        zipPath = path.replace(/\.[^/.]+$/, fileExtension);
      } else {
        // Flat structure
        const baseName = this.getBaseName(path || `file-${Date.now()}`);
        zipPath = baseName + fileExtension;
      }

      // Add to ZIP
      zip.file(zipPath, blob);
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    return { blob: zipBlob, filename };
  }

  /**
   * Export a folder and its contents
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} ZIP blob
   */
  async exportFolder(options = {}) {
    const {
      folderPath,
      workspacePath,
      format = 'markdown',
      filename,
      includeSubfolders = true,
    } = options;

    if (!folderPath) {
      throw new Error('Folder path is required');
    }

    // Get all files in folder (this will be implemented via Tauri backend)
    const files = await this.getFolderFiles(folderPath, workspacePath, includeSubfolders);

    // Export to ZIP
    const zipFilename = filename || `${this.getBaseName(folderPath)}.zip`;

    return this.exportToZip({
      files,
      format,
      filename: zipFilename,
      preserveStructure: true,
    });
  }

  /**
   * Get all files in a folder
   * @param {string} folderPath - Folder path
   * @param {string} workspacePath - Workspace path
   * @param {boolean} includeSubfolders - Include subfolders
   * @returns {Promise<Array>} Array of file objects
   */
  async getFolderFiles(folderPath, workspacePath, includeSubfolders = true) {
    try {
      // Try to use Tauri API
      const { invoke } = await import('@tauri-apps/api/core');

      // Get folder contents
      const entries = await invoke('list_workspace_directory', {
        workspacePath,
        relativePath: folderPath,
      });

      const files = [];

      for (let entry of entries) {
        if (entry.is_directory) {
          if (includeSubfolders) {
            // Recursively get files from subdirectories
            const subFiles = await this.getFolderFiles(
              entry.path,
              workspacePath,
              includeSubfolders
            );
            files.push(...subFiles);
          }
        } else if (entry.name.endsWith('.md')) {
          // Read file content
          const content = await invoke('read_workspace_file', {
            workspacePath,
            relativePath: entry.path,
          });

          files.push({
            path: entry.path,
            htmlContent: content,
            metadata: {
              title: this.getBaseName(entry.name),
              created: entry.created,
              modified: entry.modified,
            },
          });
        }
      }

      return files;
    } catch (error) {
      console.error('Error getting folder files:', error);
      return [];
    }
  }

  /**
   * Download a file
   * @param {Blob} blob - File blob
   * @param {string} filename - Filename
   */
  async download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get base name from path
   * @param {string} path - File path
   * @returns {string} Base name without extension
   */
  getBaseName(path) {
    const name = path.split('/').pop();
    return name.replace(/\.[^/.]+$/, '');
  }

  /**
   * Batch export multiple notes
   * @param {Array} notes - Array of note objects
   * @param {string} format - Export format ('markdown' or 'pdf')
   * @returns {Promise<Object>} Export result
   */
  async batchExport(notes, format = 'markdown') {
    const files = notes.map(note => ({
      path: note.path,
      htmlContent: note.content,
      metadata: {
        title: note.title || this.getBaseName(note.path),
        created: note.created,
        modified: note.modified,
        tags: note.tags || [],
      },
    }));

    return this.exportToZip({
      files,
      format,
      filename: `batch-export-${Date.now()}.zip`,
      preserveStructure: true,
    });
  }

  /**
   * Preview export (returns markdown string for preview)
   * @param {string} htmlContent - HTML content
   * @param {Object} options - Export options
   * @returns {string} Markdown preview
   */
  previewMarkdown(htmlContent, options = {}) {
    return this.markdownExporter.export(htmlContent, options);
  }

  /**
   * Get file metadata from path
   * @param {string} filePath - File path
   * @param {string} workspacePath - Workspace path
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(filePath, workspacePath) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const stats = await invoke('get_file_stats', {
        workspacePath,
        relativePath: filePath,
      });

      return {
        title: this.getBaseName(filePath),
        created: stats.created,
        modified: stats.modified,
        size: stats.size,
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return {
        title: this.getBaseName(filePath),
      };
    }
  }

  /**
   * Convert images to base64 for embedding
   * @param {string} htmlContent - HTML content with images
   * @returns {Promise<string>} HTML with embedded images
   */
  async embedImages(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const images = doc.querySelectorAll('img');

    for (let img of images) {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http')) {
        try {
          // Convert local image to base64
          const base64 = await this.imageToBase64(src);
          img.setAttribute('src', base64);
        } catch (error) {
          console.error('Error embedding image:', error);
        }
      }
    }

    return doc.body.innerHTML;
  }

  /**
   * Convert image to base64
   * @param {string} imagePath - Image path
   * @returns {Promise<string>} Base64 data URL
   */
  async imageToBase64(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = reject;
      img.src = imagePath;
    });
  }
}

export default new ExportManager();
