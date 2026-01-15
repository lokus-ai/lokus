import React, { useState, useEffect, useRef } from 'react'
import { Link2, X, Image, Loader2 } from 'lucide-react'

export default function ImageUrlModal({ isOpen, onClose, onSubmit, position }) {
  const [url, setUrl] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setUrl('')
      setError('')
      setIsValidating(false)
      // Focus input after a tiny delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Please enter a URL')
      return
    }

    // Basic URL validation
    if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith('data:')) {
      setError('Please enter a valid URL (starting with http:// or https://)')
      return
    }

    setIsValidating(true)
    setError('')

    // Quick validation - just check if it looks like an image URL or try to load it
    try {
      // Just submit - the image will show broken if invalid, which is fine
      onSubmit(trimmedUrl)
      onClose()
    } catch (err) {
      setError('Failed to load image')
    } finally {
      setIsValidating(false)
    }
  }

  const handlePaste = (e) => {
    // Auto-submit if pasting a valid URL
    const pastedText = e.clipboardData?.getData('text/plain')?.trim()
    if (pastedText && /^https?:\/\//i.test(pastedText)) {
      e.preventDefault()
      setUrl(pastedText)
      // Auto-submit after paste
      setTimeout(() => {
        onSubmit(pastedText)
        onClose()
      }, 50)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

      {/* Modal */}
      <div
        className="relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Image className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">Insert Image from URL</span>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              <Link2 className="w-4 h-4" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError('')
              }}
              onPaste={handlePaste}
              placeholder="Paste or type image URL..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)]">Enter</kbd>
              {' '}to insert{' '}
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)]">Esc</kbd>
              {' '}to cancel
            </p>
            <button
              type="submit"
              disabled={isValidating || !url.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking...
                </>
              ) : (
                'Insert'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
