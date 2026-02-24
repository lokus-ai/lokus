import React, { useState, useCallback, useEffect, useRef } from "react";

/**
 * Plain textarea fallback when TipTap can't render content.
 * Shows raw markdown in source mode — can never crash.
 */
export default function RawEditorFallback({ content, onContentChange, onRetry }) {
  const [value, setValue] = useState(content || "");
  const userEdited = useRef(false);

  // Sync when content prop changes (e.g. file reload), but not if user has edited locally
  useEffect(() => {
    if (!userEdited.current && content != null) {
      setValue(content);
    }
  }, [content]);

  const handleChange = useCallback((e) => {
    const raw = e.target.value;
    userEdited.current = true;
    setValue(raw);
    onContentChange?.(raw);
  }, [onContentChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Warning banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-200 text-sm shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span>
          <strong>Source Mode</strong> — This file could not be rendered. Edit raw markdown here.
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto px-3 py-1 text-xs font-medium rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 transition-colors"
          >
            Retry Rich Editor
          </button>
        )}
      </div>

      {/* Raw textarea editor */}
      <textarea
        className="flex-1 w-full p-8 md:p-12 bg-app-bg text-app-text resize-none outline-none"
        style={{
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
          fontSize: "14px",
          lineHeight: "1.6",
          tabSize: 4,
        }}
        value={value}
        onChange={handleChange}
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}
