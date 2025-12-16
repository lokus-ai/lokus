/**
 * Markdown Exporter
 * Converts TipTap HTML content to clean Markdown
 */

import { DOMParser } from '@tiptap/pm/model';
export class MarkdownExporter {
  constructor() {
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

              // Target already contains the full format: "path|displayName" or just "name"
              // Save it as-is to preserve the link format
              if (embed) {
                result += `![[${target}]]`;
              } else {
                result += `[[${target}]]`;
              }
            }
            // Handle canvas links
            else if (dataType === 'canvas-link' && preserveWikiLinks) {
              // Get canvas name from the link text (content) or data attribute
              const canvasName = content.trim();
              result += `![${canvasName}]`;
            }
            else {
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
            // Check for TipTap task item (new structure with data-type attribute)
            const isTaskItem = child.getAttribute('data-type') === 'taskItem';
            const taskState = child.getAttribute('data-task-state');

            if (isTaskItem && taskState) {
              // Map task state to markdown symbol (supports all 23 SmartTask states)
              const stateToSymbol = {
                'todo': ' ',
                'completed': 'x',
                'in-progress': '/',
                'urgent': '!',
                'question': '?',
                'cancelled': '-',
                'delegated': '>',
                // High frequency
                'starred': '*',
                'paused': '~',
                'scheduled': '<',
                'quote': '"',
                'info': 'i',
                'blocked': 'b',
                // Medium frequency
                'added': '+',
                'waiting': 'w',
                'mentioned': '@',
                'review': 'R',
                'duplicate': 'D',
                'started': 'S'
              };
              const symbol = stateToSymbol[taskState] || ' ';
              const text = this.getTextContent(child);
              result += `- [${symbol}] ${text}\n`;
            }
            // Fallback for legacy checkbox HTML (backward compatibility)
            else {
              const checkbox = child.querySelector('input[type="checkbox"]');
              if (checkbox) {
                const checked = checkbox.checked ? 'x' : ' ';
                const text = this.getTextContent(child, checkbox);
                result += `- [${checked}] ${text}\n`;
              } else {
                result += `- ${content}\n`;
              }
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

          // Math (KaTeX) and Canvas Links
          case 'span':
            const dataMath = child.getAttribute('data-math');
            const dataType2 = child.getAttribute('data-type');
            if (dataType2 === 'math-inline' && dataMath) {
              result += `$${dataMath}$`;
            } else if (dataType2 === 'math-block' && dataMath) {
              result += `\n$$${dataMath}$$\n\n`;
            } else if (dataType2 === 'canvas-link') {
              // Handle canvas links (now using span instead of a)
              const canvasName = child.textContent.trim();
              result += `![${canvasName}]`;
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
        const marker = ordered ? `${index}.` : '-';

        // Check for TipTap task item (new structure with data-type attribute)
        const isTaskItem = li.getAttribute('data-type') === 'taskItem';
        const taskState = li.getAttribute('data-task-state');

        if (isTaskItem && taskState) {
          // Map task state to markdown symbol (supports all 23 SmartTask states)
          const stateToSymbol = {
            'todo': ' ',
            'completed': 'x',
            'in-progress': '/',
            'urgent': '!',
            'question': '?',
            'cancelled': '-',
            'delegated': '>',
            // High frequency
            'starred': '*',
            'paused': '~',
            'scheduled': '<',
            'quote': '"',
            'info': 'i',
            'blocked': 'b',
            // Medium frequency
            'added': '+',
            'waiting': 'w',
            'mentioned': '@',
            'review': 'R',
            'duplicate': 'D',
            'started': 'S'
          };
          const symbol = stateToSymbol[taskState] || ' ';
          const text = this.getTextContent(li);
          result += `${marker} [${symbol}] ${text}\n`;
        }
        // Fallback for legacy checkbox HTML (backward compatibility)
        else {
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox) {
            const checked = checkbox.checked ? 'x' : ' ';
            const text = this.getTextContent(li, checkbox);
            result += `${marker} [${checked}] ${text}\n`;
          } else {
            const content = this.processNode(li, options).trim();
            result += `${marker} ${content}\n`;
          }
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
    let hasProcessedHeader = false;

    // Process thead (standard HTML tables)
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
        hasProcessedHeader = true;
      }
    }

    // Process tbody (standard HTML tables)
    const tbody = tableElement.querySelector('tbody');
    if (tbody) {
      const bodyRows = tbody.querySelectorAll('tr');
      for (let tr of bodyRows) {
        const cells = Array.from(tr.querySelectorAll('th, td'))
          .map(cell => cell.textContent.trim());
        rows.push(cells);
      }
    }

    // If no thead/tbody (TipTap style), process all <tr> directly
    if (!thead && !tbody) {
      const allRows = tableElement.querySelectorAll('tr');
      for (let i = 0; i < allRows.length; i++) {
        const tr = allRows[i];
        const cells = Array.from(tr.querySelectorAll('th, td'))
          .map(cell => cell.textContent.trim());

        // First row with <th> elements = header row
        if (i === 0 && tr.querySelector('th')) {
          rows.push(cells);
          // Add separator after header
          const separator = cells.map(() => '---');
          rows.push(separator);
          hasProcessedHeader = true;
        } else {
          rows.push(cells);
        }
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
