/**
 * Markdown Exporter
 * Converts TipTap HTML content to clean Markdown
 */

import { DOMParser } from '@tiptap/pm/model';
import { getMarkdownCompiler } from '../markdown/compiler.js';

export class MarkdownExporter {
  constructor() {
    this.compiler = getMarkdownCompiler();
  }

  /**
   * Convert HTML content to Markdown
   * @param {string} htmlContent - TipTap HTML content
   * @param {Object} options - Export options
   * @returns {string} Markdown string
   */
  export(htmlContent, options = {}) {
    const {
      preserveWikiLinks = true,
      includeMetadata = true,
      metadata = {},
    } = options;

    let markdown = this.htmlToMarkdown(htmlContent, { preserveWikiLinks });

    // Add frontmatter if metadata is provided
    if (includeMetadata && Object.keys(metadata).length > 0) {
      markdown = this.addFrontmatter(markdown, metadata);
    }

    return markdown;
  }

  /**
   * Convert HTML to Markdown
   * @param {string} html - HTML content
   * @param {Object} options - Conversion options
   * @returns {string} Markdown string
   */
  htmlToMarkdown(html, options = {}) {
    const { preserveWikiLinks = true } = options;

    // Create a temporary DOM element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    return this.processNode(temp, { preserveWikiLinks });
  }

  /**
   * Process a DOM node and convert to Markdown
   * @param {Node} node - DOM node
   * @param {Object} options - Processing options
   * @returns {string} Markdown string
   */
  processNode(node, options = {}) {
    const { preserveWikiLinks = true } = options;
    let result = '';

    for (let child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const content = this.processNode(child, options);

        switch (tag) {
          // Headings
          case 'h1':
            result += `\n# ${content}\n\n`;
            break;
          case 'h2':
            result += `\n## ${content}\n\n`;
            break;
          case 'h3':
            result += `\n### ${content}\n\n`;
            break;
          case 'h4':
            result += `\n#### ${content}\n\n`;
            break;
          case 'h5':
            result += `\n##### ${content}\n\n`;
            break;
          case 'h6':
            result += `\n###### ${content}\n\n`;
            break;

          // Paragraph
          case 'p':
            result += `${content}\n\n`;
            break;

          // Text formatting
          case 'strong':
          case 'b':
            result += `**${content}**`;
            break;
          case 'em':
          case 'i':
            result += `*${content}*`;
            break;
          case 'code':
            result += `\`${content}\``;
            break;
          case 'del':
          case 's':
            result += `~~${content}~~`;
            break;
          case 'mark':
            result += `==${content}==`;
            break;
          case 'sup':
            result += `^${content}^`;
            break;
          case 'sub':
            result += `~${content}~`;
            break;

          // Links
          case 'a':
            const href = child.getAttribute('href') || '';
            const dataType = child.getAttribute('data-type');

            // Handle wiki links
            if (dataType === 'wiki-link' && preserveWikiLinks) {
              const target = child.getAttribute('target') || '';
              const embed = child.hasAttribute('data-embed');
              if (embed) {
                result += `![[${target}]]`;
              } else {
                result += `[[${target}]]`;
              }
            } else {
              result += `[${content}](${href})`;
            }
            break;

          // Images
          case 'img':
            const src = child.getAttribute('src') || '';
            const alt = child.getAttribute('alt') || '';
            result += `![${alt}](${src})\n\n`;
            break;

          // Lists
          case 'ul':
            result += this.processList(child, false, options);
            break;
          case 'ol':
            result += this.processList(child, true, options);
            break;

          // Task lists
          case 'li':
            const checkbox = child.querySelector('input[type="checkbox"]');
            if (checkbox) {
              const checked = checkbox.checked ? 'x' : ' ';
              const text = this.getTextContent(child, checkbox);
              result += `- [${checked}] ${text}\n`;
            } else {
              result += `- ${content}\n`;
            }
            break;

          // Code blocks
          case 'pre':
            const codeElement = child.querySelector('code');
            if (codeElement) {
              const language = this.extractLanguage(codeElement);
              const code = codeElement.textContent || '';
              result += `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
            } else {
              result += `\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
            break;

          // Blockquote
          case 'blockquote':
            const lines = content.trim().split('\n');
            result += lines.map(line => `> ${line}`).join('\n') + '\n\n';
            break;

          // Horizontal rule
          case 'hr':
            result += '\n---\n\n';
            break;

          // Tables
          case 'table':
            result += this.processTable(child);
            break;

          // Math (KaTeX)
          case 'span':
            const dataMath = child.getAttribute('data-math');
            const dataType2 = child.getAttribute('data-type');
            if (dataType2 === 'math-inline' && dataMath) {
              result += `$${dataMath}$`;
            } else if (dataType2 === 'math-block' && dataMath) {
              result += `\n$$${dataMath}$$\n\n`;
            } else {
              result += content;
            }
            break;

          // Div and other block elements
          case 'div':
            const mathType = child.getAttribute('data-type');
            if (mathType === 'math-block') {
              const mathContent = child.getAttribute('data-math');
              if (mathContent) {
                result += `\n$$${mathContent}$$\n\n`;
              }
            } else {
              result += content;
            }
            break;

          // Line breaks
          case 'br':
            result += '\n';
            break;

          // Default: just include content
          default:
            result += content;
        }
      }
    }

    return result;
  }

  /**
   * Process a list element (ul or ol)
   * @param {HTMLElement} listElement - List element
   * @param {boolean} ordered - Whether it's an ordered list
   * @param {Object} options - Processing options
   * @returns {string} Markdown string
   */
  processList(listElement, ordered, options) {
    let result = '\n';
    let index = 1;

    for (let li of listElement.children) {
      if (li.tagName.toLowerCase() === 'li') {
        const checkbox = li.querySelector('input[type="checkbox"]');
        const marker = ordered ? `${index}.` : '-';

        if (checkbox) {
          const checked = checkbox.checked ? 'x' : ' ';
          const text = this.getTextContent(li, checkbox);
          result += `${marker} [${checked}] ${text}\n`;
        } else {
          const content = this.processNode(li, options).trim();
          result += `${marker} ${content}\n`;
        }

        if (ordered) index++;
      }
    }

    return result + '\n';
  }

  /**
   * Process a table element
   * @param {HTMLElement} tableElement - Table element
   * @returns {string} Markdown string
   */
  processTable(tableElement) {
    let result = '\n';
    const rows = [];

    // Process thead
    const thead = tableElement.querySelector('thead');
    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th, td'))
          .map(cell => cell.textContent.trim());
        rows.push(headers);

        // Add separator
        const separator = headers.map(() => '---');
        rows.push(separator);
      }
    }

    // Process tbody
    const tbody = tableElement.querySelector('tbody');
    if (tbody) {
      const bodyRows = tbody.querySelectorAll('tr');
      for (let tr of bodyRows) {
        const cells = Array.from(tr.querySelectorAll('th, td'))
          .map(cell => cell.textContent.trim());
        rows.push(cells);
      }
    }

    // Format as markdown table
    for (let row of rows) {
      result += '| ' + row.join(' | ') + ' |\n';
    }

    return result + '\n';
  }

  /**
   * Get text content excluding specific child elements
   * @param {HTMLElement} element - Parent element
   * @param {HTMLElement} exclude - Element to exclude
   * @returns {string} Text content
   */
  getTextContent(element, exclude) {
    const clone = element.cloneNode(true);
    if (exclude && clone.contains(exclude)) {
      const excludeClone = clone.querySelector('input[type="checkbox"]');
      if (excludeClone) {
        excludeClone.remove();
      }
    }
    return clone.textContent.trim();
  }

  /**
   * Extract language from code element class
   * @param {HTMLElement} codeElement - Code element
   * @returns {string} Language identifier
   */
  extractLanguage(codeElement) {
    const className = codeElement.className || '';
    const match = className.match(/language-(\w+)/);
    return match ? match[1] : '';
  }

  /**
   * Add YAML frontmatter to markdown
   * @param {string} markdown - Markdown content
   * @param {Object} metadata - Metadata object
   * @returns {string} Markdown with frontmatter
   */
  addFrontmatter(markdown, metadata) {
    const lines = ['---'];

    for (let [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'string' && value.includes('\n')) {
          lines.push(`${key}: |`);
          value.split('\n').forEach(line => {
            lines.push(`  ${line}`);
          });
        } else if (Array.isArray(value)) {
          lines.push(`${key}:`);
          value.forEach(item => {
            lines.push(`  - ${item}`);
          });
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n') + markdown;
  }
}

export default new MarkdownExporter();
