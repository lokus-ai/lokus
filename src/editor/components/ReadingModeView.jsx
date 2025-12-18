import React, { useEffect, useRef } from 'react';
import '../styles/editor.css';

/**
 * ReadingModeView Component
 *
 * Displays editor content in a clean, non-editable reading view.
 * - No contentEditable
 * - Clean HTML rendering
 * - Full support for all editor features (math, tables, callouts, etc.)
 * - Dark mode compatible
 */
const ReadingModeView = ({ content, editorSettings }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && content) {
      // Set the HTML content
      containerRef.current.innerHTML = content;

      // Add click handlers for interactive elements
      const handleCalloutToggle = (e) => {
        const target = e.target;
        if (target.classList?.contains('callout-toggle') || target.getAttribute?.('data-toggle')) {
          const calloutHeader = target.closest('.callout-header');
          if (!calloutHeader) return;

          const callout = calloutHeader.parentElement;
          if (!callout) return;

          const content = callout.querySelector('.callout-content');
          const toggle = callout.querySelector('.callout-toggle');

          if (content && toggle) {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? '' : 'none';
            toggle.textContent = isCollapsed ? '▼' : '▶';
            callout.setAttribute('data-collapsed', isCollapsed ? 'false' : 'true');
          }
        }
      };

      const handleWikiLinkClick = async (e) => {
        const target = e.target;
        if (target.closest('[data-type="wiki-link"]')) {
          e.preventDefault();
          const el = target.closest('[data-type="wiki-link"]');
          let href = el.getAttribute('href');
          const linkTarget = el.getAttribute('target') || '';

          if (href) {
            // Check if href is a valid path in the file index
            const index = globalThis.__LOKUS_FILE_INDEX__ || [];
            let fileExists = index.some(f => f.path === href);

            // If href is not a valid path, try to resolve it
            if (!fileExists && index.length > 0) {
              let searchTerm = linkTarget ? linkTarget.split('|')[0].split('^')[0].split('#')[0].trim() : href;
              const filename = (p) => (p || '').split(/[\\/]/).pop();
              const dirname = (p) => {
                if (!p) return '';
                const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
                return i >= 0 ? p.slice(0, i) : '';
              };
              const wsPath = globalThis.__LOKUS_WORKSPACE_PATH__ || '';

              // Check for explicit root marker (./)
              const isExplicitRoot = searchTerm.startsWith('./');
              if (isExplicitRoot) {
                searchTerm = searchTerm.slice(2);
                // Find file in workspace root only
                const rootFile = index.find(f => {
                  const name = filename(f.path);
                  const dir = dirname(f.path);
                  const isInRoot = dir === wsPath || dir === wsPath.replace(/\/$/, '');
                  return isInRoot && (name === searchTerm || name === `${searchTerm}.md`);
                });
                if (rootFile) {
                  href = rootFile.path;
                }
              } else {
                const hasPath = /[/\\]/.test(searchTerm);
                const activePath = globalThis.__LOKUS_ACTIVE_FILE__ || '';
                const activeDir = dirname(activePath);

                // Find all matching files
                const candidates = index.filter(f => {
                  if (hasPath) {
                    return f.path.endsWith(searchTerm) ||
                           f.path.endsWith(`${searchTerm}.md`);
                  }
                  const name = filename(f.path);
                  return name === searchTerm ||
                         name === `${searchTerm}.md` ||
                         name.replace('.md', '') === searchTerm;
                });

                if (candidates.length > 0) {
                  // Prefer file in same folder as current file
                  const sameFolder = candidates.find(f => dirname(f.path) === activeDir);
                  href = sameFolder ? sameFolder.path : candidates[0].path;
                }
              }
            }

            // Emit event to open file
            try {
              const { emit } = await import('@tauri-apps/api/event');
              await emit('lokus:open-file', href);
            } catch {
              try {
                window.dispatchEvent(new CustomEvent('lokus:open-file', { detail: href }));
              } catch {}
            }
          }
        }
      };

      containerRef.current.addEventListener('click', handleCalloutToggle);
      containerRef.current.addEventListener('click', handleWikiLinkClick);

      // Render math if KaTeX is available
      if (window.katex || window.renderMathInElement) {
        try {
          const renderMath = async () => {
            // Try to load KaTeX auto-render if not already loaded
            if (!window.renderMathInElement && window.katex) {
              try {
                await import('katex/dist/contrib/auto-render.js');
              } catch {}
            }

            if (window.renderMathInElement) {
              window.renderMathInElement(containerRef.current, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false },
                  { left: '\\[', right: '\\]', display: true },
                  { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
              });
            }
          };
          renderMath();
        } catch { }
      }

      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('click', handleCalloutToggle);
          containerRef.current.removeEventListener('click', handleWikiLinkClick);
        }
      };
    }
  }, [content]);

  // Apply editor settings as CSS variables
  useEffect(() => {
    if (containerRef.current && editorSettings) {
      const { font, typography, appearance } = editorSettings;

      if (font) {
        containerRef.current.style.setProperty('--editor-font-family', font.family);
        containerRef.current.style.setProperty('--editor-font-size', `${font.size}px`);
        containerRef.current.style.setProperty('--editor-line-height', font.lineHeight);
        containerRef.current.style.setProperty('--editor-letter-spacing', `${font.letterSpacing}em`);
      }

      if (typography) {
        containerRef.current.style.setProperty('--editor-h1-size', `${typography.h1Size}em`);
        containerRef.current.style.setProperty('--editor-h2-size', `${typography.h2Size}em`);
        containerRef.current.style.setProperty('--editor-h3-size', `${typography.h3Size}em`);
        containerRef.current.style.setProperty('--editor-heading-color', typography.headingColor);
        containerRef.current.style.setProperty('--editor-link-color', typography.linkColor);
      }

      if (appearance) {
        containerRef.current.classList.toggle('focus-mode', appearance.focusMode);
        containerRef.current.classList.toggle('typewriter-mode', appearance.typewriterMode);
      }
    }
  }, [editorSettings]);

  return (
    <div
      ref={containerRef}
      className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl reading-mode-view tiptap-area obsidian-editor"
      style={{
        padding: '1rem',
        borderRadius: '0.5rem',
        minHeight: '60vh',
        paddingBottom: '4rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontVariantLigatures: 'contextual common-ligatures',
        fontFeatureSettings: '"calt" 1, "liga" 1, "kern" 1'
      }}
    />
  );
};

export default ReadingModeView;
