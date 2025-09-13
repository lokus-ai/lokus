/**
 * Document Export Plugin for Lokus
 * 
 * This plugin demonstrates:
 * - File system operations (reading/writing files)
 * - Document format conversion
 * - PDF generation using browser APIs
 * - HTML template generation
 * - Toolbar button and menu integration
 * - File dialog and user interaction
 * - Settings management for export preferences
 */

import { BasePlugin } from '../../src/plugins/core/BasePlugin.js';

export default class ExportPlugin extends BasePlugin {
  constructor() {
    super();
    this.panelId = null;
    this.exportFormats = new Map();
  }

  /**
   * Plugin activation - setup export formats and UI
   */
  async activate() {
    await super.activate();
    
    try {
      // Initialize export formats
      this.initializeFormats();
      
      // Register commands
      this.registerCommands();
      
      // Register toolbar button
      this.registerToolbarButton();
      
      // Setup UI panel
      this.setupUI();
      
      this.showNotification('Document Export plugin activated', 'info');
      
    } catch (error) {
      this.logger.error('Failed to activate Export plugin:', error);
      this.showNotification('Failed to activate Export plugin', 'error');
      throw error;
    }
  }

  /**
   * Initialize supported export formats
   */
  initializeFormats() {
    this.exportFormats.set('pdf', {
      name: 'PDF Document',
      extension: 'pdf',
      mimeType: 'application/pdf',
      description: 'Portable Document Format for printing and sharing',
      icon: '📄',
      handler: (content, filename) => this.exportToPDF(content, filename)
    });

    this.exportFormats.set('html', {
      name: 'HTML Document',
      extension: 'html',
      mimeType: 'text/html',
      description: 'Web page format with styling and formatting',
      icon: '🌐',
      handler: (content, filename) => this.exportToHTML(content, filename)
    });

    this.exportFormats.set('markdown', {
      name: 'Markdown',
      extension: 'md',
      mimeType: 'text/markdown',
      description: 'Plain text format with markup syntax',
      icon: '📝',
      handler: (content, filename) => this.exportToMarkdown(content, filename)
    });

    this.exportFormats.set('text', {
      name: 'Plain Text',
      extension: 'txt',
      mimeType: 'text/plain',
      description: 'Simple plain text without formatting',
      icon: '📄',
      handler: (content, filename) => this.exportToText(content, filename)
    });

    this.logger.info(`Initialized ${this.exportFormats.size} export formats`);
  }

  /**
   * Register export commands
   */
  registerCommands() {
    // Individual format commands
    this.registerCommand({
      name: 'to-pdf',
      description: 'Export to PDF',
      action: () => this.exportDocument('pdf')
    });

    this.registerCommand({
      name: 'to-html',
      description: 'Export to HTML',
      action: () => this.exportDocument('html')
    });

    this.registerCommand({
      name: 'to-markdown',
      description: 'Export to Markdown',
      action: () => this.exportDocument('markdown')
    });

    this.registerCommand({
      name: 'to-text',
      description: 'Export to Plain Text',
      action: () => this.exportDocument('text')
    });

    // Show export panel command
    this.registerCommand({
      name: 'show-panel',
      description: 'Show Export Panel',
      action: () => this.toggleExportPanel()
    });
  }

  /**
   * Register toolbar button
   */
  registerToolbarButton() {
    this.registerToolbarButton({
      name: 'export-document',
      title: 'Export Document',
      icon: '📤',
      action: () => this.toggleExportPanel()
    });
  }

  /**
   * Setup UI components
   */
  setupUI() {
    // Register export panel
    this.panelId = this.registerPanel({
      name: 'document-export',
      title: 'Export Document',
      position: 'sidebar',
      content: this.createExportPanelContent(),
      icon: '📤'
    });
  }

  /**
   * Create export panel content
   */
  createExportPanelContent() {
    const formatItems = Array.from(this.exportFormats.entries())
      .map(([key, format]) => {
        return `
          <div class="export-format-item" data-format="${key}">
            <div class="format-header">
              <span class="format-icon">${format.icon}</span>
              <span class="format-name">${format.name}</span>
            </div>
            <div class="format-description">${format.description}</div>
            <div class="format-actions">
              <button class="btn-export" onclick="window.exportPlugin?.exportDocument('${key}')">
                Export as ${format.extension.toUpperCase()}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="export-panel">
        <div class="export-panel-header">
          <h3>Export Document</h3>
          <div class="current-document">
            <span id="document-info">Ready to export</span>
          </div>
        </div>
        
        <div class="export-formats">
          <h4>Choose Format</h4>
          ${formatItems}
        </div>
        
        <div class="export-settings">
          <h4>Export Settings</h4>
          
          <label class="setting-item">
            <input type="checkbox" id="include-metadata" ${this.getSetting('includeMetadata', true) ? 'checked' : ''}>
            <span>Include metadata</span>
          </label>
          
          <label class="setting-item">
            <input type="checkbox" id="open-after-export" ${this.getSetting('openAfterExport', false) ? 'checked' : ''}>
            <span>Open after export</span>
          </label>
          
          <div class="setting-item">
            <label for="html-theme">HTML Theme:</label>
            <select id="html-theme">
              <option value="github">GitHub</option>
              <option value="minimal">Minimal</option>
              <option value="elegant">Elegant</option>
            </select>
          </div>
        </div>
        
        <div class="export-history">
          <h4>Recent Exports</h4>
          <div id="export-history-list">
            <div class="no-exports">No recent exports</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Export document to specified format
   */
  async exportDocument(formatKey) {
    try {
      const format = this.exportFormats.get(formatKey);
      if (!format) {
        this.showNotification(`Export format '${formatKey}' not supported`, 'error');
        return;
      }

      // Get current document content
      const content = this.getEditorContent();
      if (!content || !content.trim()) {
        this.showNotification('No content to export', 'warning');
        return;
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `document-${timestamp}.${format.extension}`;

      // Show progress
      this.showNotification(`Exporting to ${format.name}...`, 'info');

      // Call format-specific export handler
      await format.handler(content, filename);

      // Update export history
      await this.addToExportHistory(formatKey, filename);

      this.showNotification(`Successfully exported to ${format.name}`, 'success');

    } catch (error) {
      this.logger.error('Export failed:', error);
      this.showNotification(`Export failed: ${error.message}`, 'error');
    }
  }

  /**
   * Export to PDF using browser print API
   */
  async exportToPDF(content, filename) {
    try {
      // Create a temporary HTML document for printing
      const printContent = this.preparePrintContent(content);
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Failed to open print window - popup blocked?');
      }

      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load
      await new Promise(resolve => {
        printWindow.onload = resolve;
        setTimeout(resolve, 1000); // Fallback
      });

      // Trigger print dialog
      printWindow.print();

      // Note: This opens the browser's print dialog. 
      // The user can choose "Save as PDF" as the destination.
      // For programmatic PDF generation, we'd need a library like jsPDF or puppeteer
      
      // Close the print window after a delay
      setTimeout(() => {
        printWindow.close();
      }, 2000);

      // For demonstration, we'll also create a downloadable HTML version
      await this.downloadFile(printContent, filename.replace('.pdf', '.html'), 'text/html');

    } catch (error) {
      this.logger.error('PDF export failed:', error);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  /**
   * Export to HTML with styling
   */
  async exportToHTML(content, filename) {
    try {
      const htmlTheme = await this.getSetting('htmlTheme', 'github');
      const includeMetadata = await this.getSetting('includeMetadata', true);
      
      const htmlContent = this.generateHTMLDocument(content, {
        theme: htmlTheme,
        includeMetadata,
        title: filename.replace('.html', '')
      });

      await this.downloadFile(htmlContent, filename, 'text/html');

    } catch (error) {
      this.logger.error('HTML export failed:', error);
      throw error;
    }
  }

  /**
   * Export to Markdown format
   */
  async exportToMarkdown(content, filename) {
    try {
      // Convert HTML content to Markdown
      const markdownContent = this.htmlToMarkdown(content);
      
      // Add metadata if enabled
      const includeMetadata = await this.getSetting('includeMetadata', true);
      let finalContent = markdownContent;
      
      if (includeMetadata) {
        const metadata = this.generateMetadata();
        finalContent = `${metadata}\n\n${markdownContent}`;
      }

      await this.downloadFile(finalContent, filename, 'text/markdown');

    } catch (error) {
      this.logger.error('Markdown export failed:', error);
      throw error;
    }
  }

  /**
   * Export to plain text
   */
  async exportToText(content, filename) {
    try {
      // Strip HTML and convert to plain text
      const textContent = this.htmlToText(content);
      
      await this.downloadFile(textContent, filename, 'text/plain');

    } catch (error) {
      this.logger.error('Text export failed:', error);
      throw error;
    }
  }

  /**
   * Prepare content for printing/PDF
   */
  preparePrintContent(content) {
    const margins = this.getSetting('pdfMargins', '1in');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Exported Document</title>
        <style>
          @page {
            margin: ${margins};
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #333;
            max-width: none;
          }
          
          h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 24px;
            margin-bottom: 16px;
          }
          
          h1 { font-size: 24pt; }
          h2 { font-size: 20pt; }
          h3 { font-size: 16pt; }
          
          p {
            margin-bottom: 12pt;
          }
          
          code {
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          }
          
          pre {
            background: #f8f9fa;
            padding: 12pt;
            border-radius: 6px;
            border-left: 4px solid #0066cc;
            overflow-x: auto;
          }
          
          blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16pt;
            margin-left: 0;
            color: #666;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 16pt;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 8pt 12pt;
            text-align: left;
          }
          
          th {
            background: #f8f9fa;
            font-weight: bold;
          }
          
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML document with theme
   */
  generateHTMLDocument(content, options = {}) {
    const { theme = 'github', includeMetadata = true, title = 'Document' } = options;
    
    const themeCSS = this.getHTMLThemeCSS(theme);
    const metadata = includeMetadata ? this.generateMetadata() : '';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${themeCSS}</style>
      </head>
      <body>
        ${metadata ? `<div class="metadata">${metadata}</div>` : ''}
        <div class="content">
          ${content}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get CSS for HTML themes
   */
  getHTMLThemeCSS(theme) {
    const themes = {
      github: `
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6;
          color: #24292f;
          max-width: 1012px;
          margin: 0 auto;
          padding: 45px;
        }
        
        h1, h2 { border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        
        code {
          background: rgba(175,184,193,0.2);
          padding: 0.2em 0.4em;
          border-radius: 6px;
          font-size: 85%;
        }
        
        pre {
          background: #f6f8fa;
          border-radius: 6px;
          padding: 16px;
          overflow: auto;
        }
        
        blockquote {
          border-left: 0.25em solid #d0d7de;
          padding-left: 1em;
          color: #656d76;
        }
      `,
      
      minimal: `
        body {
          font-family: Georgia, serif;
          line-height: 1.8;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 2em;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-weight: normal;
          margin-top: 2em;
          margin-bottom: 1em;
        }
        
        h1 { font-size: 2.5em; }
        h2 { font-size: 2em; }
        
        code, pre {
          font-family: 'SF Mono', Monaco, monospace;
          background: #f9f9f9;
        }
        
        code { padding: 0.1em 0.3em; }
        pre { padding: 1em; border-left: 3px solid #ccc; }
        
        blockquote {
          font-style: italic;
          border-left: 3px solid #ccc;
          padding-left: 1em;
          margin-left: 0;
        }
      `,
      
      elegant: `
        body {
          font-family: 'Crimson Text', Georgia, serif;
          line-height: 1.7;
          color: #2c3e50;
          max-width: 900px;
          margin: 0 auto;
          padding: 3em;
          background: #fdfdfd;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Playfair Display', Georgia, serif;
          color: #34495e;
          margin-top: 2.5em;
          margin-bottom: 1em;
        }
        
        h1 { font-size: 3em; text-align: center; }
        h2 { font-size: 2.2em; }
        
        p { margin-bottom: 1.5em; }
        
        code {
          background: #ecf0f1;
          padding: 0.2em 0.5em;
          border-radius: 3px;
          font-family: 'Fira Code', Monaco, monospace;
        }
        
        pre {
          background: #2c3e50;
          color: #ecf0f1;
          padding: 2em;
          border-radius: 8px;
          overflow-x: auto;
        }
        
        blockquote {
          border-left: 4px solid #3498db;
          padding-left: 2em;
          font-style: italic;
          color: #7f8c8d;
        }
      `
    };
    
    return themes[theme] || themes.github;
  }

  /**
   * Convert HTML content to Markdown
   */
  htmlToMarkdown(html) {
    // Basic HTML to Markdown conversion
    let markdown = html;
    
    // Headers
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
    
    // Bold and italic
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    
    // Code
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n\n');
    
    // Links
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Lists
    markdown = markdown.replace(/<ul[^>]*>/gi, '');
    markdown = markdown.replace(/<\/ul>/gi, '\n');
    markdown = markdown.replace(/<ol[^>]*>/gi, '');
    markdown = markdown.replace(/<\/ol>/gi, '\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    
    // Paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    
    // Line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    
    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&#39;/g, "'");
    
    // Clean up whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();
    
    return markdown;
  }

  /**
   * Convert HTML to plain text
   */
  htmlToText(html) {
    // Create temporary element to strip HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Get text content and normalize whitespace
    let text = temp.textContent || temp.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  /**
   * Generate document metadata
   */
  generateMetadata() {
    const now = new Date();
    const content = this.getEditorContent();
    const wordCount = content ? content.split(/\s+/).filter(w => w.length > 0).length : 0;
    
    return `---
title: Exported Document
date: ${now.toISOString()}
exported_by: Lokus Export Plugin
word_count: ${wordCount}
---`;
  }

  /**
   * Download file to user's computer
   */
  async downloadFile(content, filename, mimeType) {
    try {
      // Create blob
      const blob = new Blob([content], { type: mimeType });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      // Check if file should be opened after export
      const openAfterExport = await this.getSetting('openAfterExport', false);
      if (openAfterExport) {
        // Note: Most browsers block automatic opening of downloaded files
        // This would require additional user permission
        this.showNotification('File downloaded. Check your Downloads folder.', 'info');
      }
      
    } catch (error) {
      this.logger.error('Download failed:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Add export to history
   */
  async addToExportHistory(format, filename) {
    try {
      const history = await this.getSetting('exportHistory', []);
      
      const exportRecord = {
        format,
        filename,
        timestamp: new Date().toISOString(),
        size: this.getEditorContent().length
      };
      
      // Add to beginning and limit to 10 entries
      history.unshift(exportRecord);
      const limitedHistory = history.slice(0, 10);
      
      await this.setSetting('exportHistory', limitedHistory);
      
      // Update UI if panel is open
      this.updateExportHistoryUI(limitedHistory);
      
    } catch (error) {
      this.logger.error('Failed to update export history:', error);
    }
  }

  /**
   * Update export history UI
   */
  updateExportHistoryUI(history) {
    const historyList = document.getElementById('export-history-list');
    if (!historyList) return;
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="no-exports">No recent exports</div>';
      return;
    }
    
    const historyItems = history.map(record => {
      const date = new Date(record.timestamp).toLocaleDateString();
      const format = this.exportFormats.get(record.format);
      
      return `
        <div class="history-item">
          <span class="history-icon">${format?.icon || '📄'}</span>
          <div class="history-details">
            <div class="history-filename">${record.filename}</div>
            <div class="history-meta">${date} • ${record.format.toUpperCase()}</div>
          </div>
        </div>
      `;
    }).join('');
    
    historyList.innerHTML = historyItems;
  }

  /**
   * Toggle export panel visibility
   */
  toggleExportPanel() {
    if (this.panelId) {
      this.api.emit('panel_toggle', { panelId: this.panelId });
      
      // Update document info when panel is opened
      this.updateDocumentInfo();
    }
  }

  /**
   * Update document information in the panel
   */
  updateDocumentInfo() {
    const infoElement = document.getElementById('document-info');
    if (!infoElement) return;
    
    const content = this.getEditorContent();
    if (content) {
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const charCount = content.length;
      infoElement.textContent = `${wordCount} words, ${charCount} characters`;
    } else {
      infoElement.textContent = 'No content to export';
    }
  }
}

// Make plugin available globally for UI interactions
if (typeof window !== 'undefined') {
  window.exportPlugin = null;
}