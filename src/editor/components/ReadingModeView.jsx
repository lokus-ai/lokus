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
          const href = el.getAttribute('href');

          if (href) {
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
        } catch (err) {
          console.error('Failed to render math:', err);
        }
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
