/**
 * PDF Exporter
 * Converts HTML content to PDF using jsPDF and html2canvas
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export class PDFExporter {
  constructor() {
    this.defaultOptions = {
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
      margin: {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40,
      },
    };
  }

  /**
   * Export HTML content to PDF
   * @param {string} htmlContent - HTML content to export
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} PDF blob
   */
  async export(htmlContent, options = {}) {
    const {
      title = 'Document',
      metadata = {},
      includeImages = true,
      pageSize = 'a4',
      orientation = 'portrait',
      margin = this.defaultOptions.margin,
    } = options;

    // Create a temporary container for rendering
    const container = this.createRenderContainer(htmlContent);
    document.body.appendChild(container);

    try {
      // Render HTML to canvas
      const canvas = await html2canvas(container, {
        scale: 2, // Higher quality
        useCORS: true, // Enable CORS for images
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        allowTaint: true,
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: pageSize,
        compress: true,
      });

      // Calculate dimensions
      const imgWidth = pdf.internal.pageSize.getWidth() - margin.left - margin.right;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight() - margin.top - margin.bottom;

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = margin.top;

      // Add first page
      pdf.addImage(imgData, 'PNG', margin.left, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if content exceeds one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin.top;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin.left, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Add metadata
      if (metadata.title) {
        pdf.setProperties({
          title: metadata.title,
          subject: metadata.subject || '',
          author: metadata.author || '',
          keywords: metadata.keywords || '',
          creator: 'Lokus',
        });
      }

      // Return as blob
      return pdf.output('blob');
    } finally {
      // Clean up temporary container
      document.body.removeChild(container);
    }
  }

  /**
   * Export HTML content directly to PDF (alternative method with better text quality)
   * @param {string} htmlContent - HTML content to export
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} PDF blob
   */
  async exportWithText(htmlContent, options = {}) {
    const {
      title = 'Document',
      metadata = {},
      pageSize = 'a4',
      orientation = 'portrait',
      margin = this.defaultOptions.margin,
    } = options;

    const pdf = new jsPDF({
      orientation,
      unit: 'pt',
      format: pageSize,
      compress: true,
    });

    // Parse HTML and extract text with formatting
    const container = this.createRenderContainer(htmlContent);
    document.body.appendChild(container);

    try {
      let yPosition = margin.top;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin.left - margin.right;

      // Process nodes
      const nodes = container.childNodes;
      for (let node of nodes) {
        if (yPosition > pageHeight - margin.bottom) {
          pdf.addPage();
          yPosition = margin.top;
        }

        const result = this.processNodeForPDF(pdf, node, margin.left, yPosition, contentWidth);
        yPosition = result.yPosition;
      }

      // Add metadata
      if (metadata.title) {
        pdf.setProperties({
          title: metadata.title,
          subject: metadata.subject || '',
          author: metadata.author || '',
          keywords: metadata.keywords || '',
          creator: 'Lokus',
        });
      }

      return pdf.output('blob');
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Process DOM node and add to PDF
   * @param {jsPDF} pdf - PDF document
   * @param {Node} node - DOM node
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} maxWidth - Maximum width
   * @returns {Object} Updated position
   */
  processNodeForPDF(pdf, node, x, y, maxWidth) {
    let yPosition = y;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, yPosition);
        yPosition += lines.length * 14; // Line height
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      switch (tag) {
        case 'h1':
          pdf.setFontSize(24);
          pdf.setFont(undefined, 'bold');
          pdf.text(node.textContent, x, yPosition);
          yPosition += 30;
          pdf.setFontSize(12);
          pdf.setFont(undefined, 'normal');
          break;

        case 'h2':
          pdf.setFontSize(20);
          pdf.setFont(undefined, 'bold');
          pdf.text(node.textContent, x, yPosition);
          yPosition += 26;
          pdf.setFontSize(12);
          pdf.setFont(undefined, 'normal');
          break;

        case 'h3':
          pdf.setFontSize(16);
          pdf.setFont(undefined, 'bold');
          pdf.text(node.textContent, x, yPosition);
          yPosition += 22;
          pdf.setFontSize(12);
          pdf.setFont(undefined, 'normal');
          break;

        case 'p':
          const lines = pdf.splitTextToSize(node.textContent, maxWidth);
          pdf.text(lines, x, yPosition);
          yPosition += lines.length * 14 + 10;
          break;

        default:
          // Process children recursively
          for (let child of node.childNodes) {
            const result = this.processNodeForPDF(pdf, child, x, yPosition, maxWidth);
            yPosition = result.yPosition;
          }
      }
    }

    return { yPosition };
  }

  /**
   * Create a temporary container for rendering HTML
   * @param {string} htmlContent - HTML content
   * @returns {HTMLElement} Container element
   */
  createRenderContainer(htmlContent) {
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: 800px;
      padding: 40px;
      background: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #000000;
    `;
    container.className = 'prose prose-sm';
    container.innerHTML = htmlContent;

    // Apply styles to ensure proper rendering
    this.applyPrintStyles(container);

    return container;
  }

  /**
   * Apply styles optimized for PDF export
   * @param {HTMLElement} container - Container element
   */
  applyPrintStyles(container) {
    // Headings
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(h => {
      h.style.color = '#000000';
      h.style.marginTop = '20px';
      h.style.marginBottom = '10px';
      h.style.fontWeight = 'bold';
    });

    // Paragraphs
    const paragraphs = container.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.style.marginBottom = '12px';
      p.style.color = '#000000';
    });

    // Links
    const links = container.querySelectorAll('a');
    links.forEach(a => {
      a.style.color = '#0066cc';
      a.style.textDecoration = 'underline';
    });

    // Code blocks
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      pre.style.backgroundColor = '#f5f5f5';
      pre.style.padding = '12px';
      pre.style.borderRadius = '4px';
      pre.style.overflow = 'auto';
      pre.style.fontSize = '12px';
    });

    // Inline code
    const inlineCode = container.querySelectorAll('code');
    inlineCode.forEach(code => {
      if (!code.parentElement || code.parentElement.tagName !== 'PRE') {
        code.style.backgroundColor = '#f5f5f5';
        code.style.padding = '2px 6px';
        code.style.borderRadius = '3px';
        code.style.fontSize = '0.9em';
      }
    });

    // Tables
    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.marginBottom = '16px';
    });

    const tableCells = container.querySelectorAll('td, th');
    tableCells.forEach(cell => {
      cell.style.border = '1px solid #ddd';
      cell.style.padding = '8px';
    });

    const tableHeaders = container.querySelectorAll('th');
    tableHeaders.forEach(th => {
      th.style.backgroundColor = '#f5f5f5';
      th.style.fontWeight = 'bold';
    });

    // Images
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    });

    // Lists
    const lists = container.querySelectorAll('ul, ol');
    lists.forEach(list => {
      list.style.marginBottom = '12px';
      list.style.paddingLeft = '24px';
    });

    // Blockquotes
    const blockquotes = container.querySelectorAll('blockquote');
    blockquotes.forEach(bq => {
      bq.style.borderLeft = '4px solid #ddd';
      bq.style.paddingLeft = '16px';
      bq.style.marginLeft = '0';
      bq.style.color = '#666';
    });
  }

  /**
   * Download PDF file
   * @param {Blob} blob - PDF blob
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
}

export default new PDFExporter();
