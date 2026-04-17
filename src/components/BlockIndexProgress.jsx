/**
 * BlockIndexProgress — tiny status bar indicator for the first-run workspace indexer.
 *
 * Listens for `lokus:block-index-progress` events and renders a compact
 * "Indexing blocks 42/100" line. Disappears automatically when done.
 * Renders nothing when not indexing.
 */

import React, { useState, useEffect } from 'react'

export default function BlockIndexProgress() {
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    function handleProgress(event) {
      const { processed, total, done } = event.detail || {}
      if (done) {
        // Brief "done" flash then hide
        setProgress({ processed: total, total, done: true })
        const timer = setTimeout(() => setProgress(null), 2000)
        return () => clearTimeout(timer)
      }
      setProgress({ processed, total, done: false })
    }
    window.addEventListener('lokus:block-index-progress', handleProgress)
    return () => window.removeEventListener('lokus:block-index-progress', handleProgress)
  }, [])

  if (!progress) return null

  const { processed, total, done } = progress

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: 'var(--text-muted, #888)',
        padding: '0 8px',
        opacity: done ? 0.5 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      {!done && (
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            border: '1.5px solid var(--accent, #3b82f6)',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      <span>
        {done
          ? `Indexed ${total} files`
          : `Indexing blocks ${processed}/${total}`}
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
