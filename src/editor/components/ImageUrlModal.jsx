import React, { useState, useEffect, useRef } from 'react'
import { Link2, X, Image, Loader2 } from 'lucide-react'

export default function ImageUrlModal({ isOpen, onClose, onSubmit }) {
  const [url, setUrl] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setUrl('')
      setError('')
      setIsValidating(false)
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

    if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith('data:')) {
      setError('Please enter a valid URL (starting with http:// or https://)')
      return
    }

    setIsValidating(true)
    setError('')

    try {
      onSubmit(trimmedUrl)
      onClose()
    } catch (err) {
      setError('Failed to load image')
    } finally {
      setIsValidating(false)
    }
  }

  const handlePaste = (e) => {
    const pastedText = e.clipboardData?.getData('text/plain')?.trim()
    if (pastedText && /^https?:\/\//i.test(pastedText)) {
      e.preventDefault()
      setUrl(pastedText)
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
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative w-[440px] rounded-xl border border-app-border bg-app-panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-app-accent/10">
            <Image className="w-4 h-4 text-app-accent" />
          </div>
          <span className="text-sm font-medium text-app-text">Insert Image from URL</span>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-app-bg text-app-muted hover:text-app-text transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted">
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
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-app-bg border border-app-border rounded-lg text-app-text placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent transition-all"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-app-muted">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-app-bg rounded border border-app-border">Enter</kbd>
              {' '}to insert{' '}
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-app-bg rounded border border-app-border">Esc</kbd>
              {' '}to cancel
            </p>
            <button
              type="submit"
              disabled={isValidating || !url.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-app-accent hover:bg-app-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-app-accent-fg rounded-lg transition-colors flex items-center gap-2"
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
