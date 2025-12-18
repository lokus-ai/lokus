/**
 * Plugin Hover Extension
 * Wires plugin-registered hover providers to TipTap editor
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { editorAPI } from '../../plugins/api/EditorAPI.js';

const PLUGIN_HOVER_KEY = new PluginKey('pluginHover');

let hoverTimeout = null;
let currentTooltip = null;

const PluginHover = Extension.create({
  name: 'pluginHover',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: PLUGIN_HOVER_KEY,

        props: {
          handleDOMEvents: {
            mousemove: async (view, event) => {
              // Clear previous timeout
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }

              // Debounce hover to avoid excessive provider calls
              hoverTimeout = setTimeout(async () => {
                try {
                  // Get position from mouse coordinates
                  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                  if (!pos) return;

                  // Get text at position
                  const { state } = view;
                  const $pos = state.doc.resolve(pos.pos);

                  // Get word at position
                  const textBefore = state.doc.textBetween(
                    Math.max(0, pos.pos - 50),
                    pos.pos
                  );
                  const textAfter = state.doc.textBetween(
                    pos.pos,
                    Math.min(state.doc.content.size, pos.pos + 50)
                  );

                  // Simple word boundary detection
                  const wordBoundary = /[\s\[\](){}'",.;:!?]/;
                  let wordStart = textBefore.length;
                  for (let i = textBefore.length - 1; i >= 0; i--) {
                    if (wordBoundary.test(textBefore[i])) {
                      wordStart = i + 1;
                      break;
                    }
                  }

                  let wordEnd = 0;
                  for (let i = 0; i < textAfter.length; i++) {
                    if (wordBoundary.test(textAfter[i])) {
                      wordEnd = i;
                      break;
                    }
                  }
                  if (wordEnd === 0) wordEnd = textAfter.length;

                  const word = textBefore.slice(wordStart) + textAfter.slice(0, wordEnd);
                  if (!word.trim()) return;

                  // Get all hover providers
                  const providers = editorAPI.getProviders('hover');
                  if (providers.length === 0) return;

                  // Create TextDocument adapter
                  const document = editorAPI._createDocumentAdapter(state);

                  // Get cursor position
                  const position = editorAPI._offsetToPosition(pos.pos);

                  // Call all providers and get first valid hover result
                  for (const reg of providers) {
                    try {
                      // Check if provider matches current document selector
                      if (reg.selector && typeof reg.selector === 'string') {
                        if (reg.selector !== 'markdown' && reg.selector !== '*') {
                          continue;
                        }
                      }

                      // Call provider's provideHover
                      const hoverResult = await reg.provider.provideHover(
                        document,
                        position
                      );

                      if (hoverResult && hoverResult.contents) {
                        // Show hover tooltip
                        showHoverTooltip(view, event, hoverResult, pos.pos);
                        return;
                      }
                    } catch (error) {
                      console.error('Plugin hover provider error:', error);
                    }
                  }

                  // No hover result found, hide tooltip
                  hideHoverTooltip();
                } catch (error) {
                  console.error('Hover error:', error);
                }
              }, 300); // 300ms debounce
            },

            mouseleave: (view, event) => {
              // Clear timeout and hide tooltip when leaving editor
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }
              hideHoverTooltip();
              return false;
            }
          }
        }
      })
    ];
  }
});

/**
 * Show hover tooltip at cursor position
 */
function showHoverTooltip(view, event, hoverResult, pos) {
  // Hide existing tooltip
  hideHoverTooltip();

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'plugin-hover-tooltip';

  // Style tooltip
  Object.assign(tooltip.style, {
    position: 'fixed',
    zIndex: '2147483646',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    padding: '12px',
    fontSize: '13px',
    color: 'var(--text)',
    maxWidth: '400px',
    maxHeight: '300px',
    overflow: 'auto',
    pointerEvents: 'none',
    wordWrap: 'break-word'
  });

  // Format hover contents
  const contents = Array.isArray(hoverResult.contents)
    ? hoverResult.contents
    : [hoverResult.contents];

  // Build tooltip content
  const contentDiv = document.createElement('div');
  for (const content of contents) {
    if (typeof content === 'string') {
      const p = document.createElement('p');
      p.textContent = content;
      p.style.margin = '0 0 8px 0';
      contentDiv.appendChild(p);
    } else if (content.value) {
      const p = document.createElement('p');
      if (content.language) {
        // Code block
        const code = document.createElement('code');
        code.textContent = content.value;
        code.style.fontFamily = 'var(--font-mono, monospace)';
        code.style.fontSize = '12px';
        p.appendChild(code);
      } else {
        // Markdown or plain text
        p.innerHTML = content.value.replace(/\n/g, '<br>');
      }
      p.style.margin = '0 0 8px 0';
      contentDiv.appendChild(p);
    }
  }

  // Remove trailing margin
  const lastChild = contentDiv.lastElementChild;
  if (lastChild) {
    lastChild.style.marginBottom = '0';
  }

  tooltip.appendChild(contentDiv);

  // Position tooltip
  const rect = view.coordsAtPos(pos);
  let left = event.clientX + 10;
  let top = rect.bottom + 10;

  // Adjust if tooltip goes off screen
  const tooltipWidth = 400; // max-width
  const tooltipHeight = 300; // estimated max-height

  if (left + tooltipWidth > window.innerWidth) {
    left = window.innerWidth - tooltipWidth - 20;
  }

  if (top + tooltipHeight > window.innerHeight) {
    top = rect.top - tooltipHeight - 10;
    if (top < 0) {
      top = 10;
    }
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  // Add to DOM
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (currentTooltip === tooltip) {
      hideHoverTooltip();
    }
  }, 5000);
}

/**
 * Hide hover tooltip
 */
function hideHoverTooltip() {
  if (currentTooltip) {
    try {
      if (currentTooltip.parentNode) {
        currentTooltip.parentNode.removeChild(currentTooltip);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    currentTooltip = null;
  }
}

export default PluginHover;
