/**
 * HTML to Markdown Converter
 * Converts TipTap HTML output to clean markdown for templates
 */

import TurndownService from 'turndown';

class HTMLToMarkdownConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    });

    // Add custom rules for TipTap-specific elements
    this.addCustomRules();
  }

  addCustomRules() {
    // Preserve template variables {{...}}
    this.turndownService.addRule('templateVariables', {
      filter: (node) => {
        return node.textContent && /\{\{.*?\}\}/.test(node.textContent);
      },
      replacement: (content) => {
        return content; // Preserve as-is
      }
    });

    // Handle task lists
    this.turndownService.addRule('taskList', {
      filter: (node) => {
        return node.nodeName === 'LI' &&
               node.getAttribute('data-type') === 'taskItem';
      },
      replacement: (content, node) => {
        const checked = node.getAttribute('data-checked') === 'true';
        const checkbox = checked ? '[x]' : '[ ]';
        return `${checkbox} ${content}`;
      }
    });

    // Handle highlights
    this.turndownService.addRule('highlight', {
      filter: ['mark'],
      replacement: (content) => {
        return `==${content}==`;
      }
    });

    // Handle strikethrough
    this.turndownService.addRule('strikethrough', {
      filter: ['s', 'del'],
      replacement: (content) => {
        return `~~${content}~~`;
      }
    });

    // Handle wiki links
    this.turndownService.addRule('wikiLink', {
      filter: (node) => {
        return node.nodeName === 'A' &&
               node.getAttribute('data-type') === 'wikiLink';
      },
      replacement: (content, node) => {
        const href = node.getAttribute('href') || content;
        return `[[${href}]]`;
      }
    });

    // Handle math (inline and block)
    this.turndownService.addRule('mathInline', {
      filter: (node) => {
        return node.nodeName === 'SPAN' &&
               node.getAttribute('data-type') === 'mathInline';
      },
      replacement: (content, node) => {
        const latex = node.getAttribute('data-latex') || content;
        return `$${latex}$`;
      }
    });

    this.turndownService.addRule('mathBlock', {
      filter: (node) => {
        return node.nodeName === 'DIV' &&
               node.getAttribute('data-type') === 'mathBlock';
      },
      replacement: (content, node) => {
        const latex = node.getAttribute('data-latex') || content;
        return `\n$$\n${latex}\n$$\n`;
      }
    });
  }

  /**
   * Convert HTML to Markdown
   * @param {string} html - HTML content from TipTap editor
   * @returns {string} Markdown content
   */
  convert(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    try {
      // Clean up any extra whitespace
      const cleanHtml = html.trim();

      // Convert to markdown
      let markdown = this.turndownService.turndown(cleanHtml);

      // Post-process: clean up extra newlines
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .trim();

      return markdown;
    } catch (error) {
      console.error('[HTMLToMarkdown] Conversion error:', error);
      // Fallback: try to extract text content
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || '';
    }
  }

  /**
   * Convert markdown back to HTML (for preview)
   * Note: This is basic - full conversion should use markdown-it
   * @param {string} markdown - Markdown content
   * @returns {string} HTML content
   */
  markdownToHtml(markdown) {
    // This is a placeholder - the editor will handle full markdown parsing
    // Just preserve the markdown as-is for template storage
    return markdown;
  }
}

// Export singleton instance
export const htmlToMarkdown = new HTMLToMarkdownConverter();

// Export class for custom instances
export default HTMLToMarkdownConverter;
