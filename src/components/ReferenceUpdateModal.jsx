import React, { useState, useEffect, useRef } from 'react'
import { X, FileText, AlertTriangle, Check, Loader2, Link2, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Modal to confirm and show reference updates when files are moved/renamed
 */
export default function ReferenceUpdateModal({
  isOpen,
  onClose,
  onConfirm,
  oldPath,
  newPath,
  affectedFiles = [],
  isProcessing = false,
  result = null,
}) {
  const [expanded, setExpanded] = useState({})
  const confirmBtnRef = useRef(null)

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || isProcessing) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter' && !e.shiftKey && affectedFiles.length > 0) {
        e.preventDefault()
        onConfirm(true) // true = update references
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isProcessing, onClose, onConfirm, affectedFiles.length])

  // Focus confirm button on open
  useEffect(() => {
    if (isOpen && !isProcessing && !result) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50)
    }
  }, [isOpen, isProcessing, result])

  if (!isOpen) return null

  const oldName = oldPath?.split('/').pop() || ''
  const newName = newPath?.split('/').pop() || ''
  const workspacePath = globalThis.__LOKUS_WORKSPACE_PATH__ || ''

  const toggleExpanded = (path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }))
  }

  const totalRefs = affectedFiles.reduce((sum, f) => sum + (f.references?.length || 1), 0)

  const getRelativePath = (path) => {
    if (!path) return ''
    if (path.startsWith(workspacePath)) {
      return path.slice(workspacePath.length).replace(/^\//, '')
    }
    return path
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isProcessing ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Link2 className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Update References
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {result ? 'Update complete' : `${affectedFiles.length} file${affectedFiles.length !== 1 ? 's' : ''} will be updated`}
            </p>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[50vh] overflow-y-auto">
          {/* File being moved/renamed */}
          <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--text-secondary)]">{getRelativePath(oldPath)}</span>
              <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-primary)] font-medium">{getRelativePath(newPath)}</span>
            </div>
          </div>

          {/* Result state */}
          {result && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Updated {result.updated} file{result.updated !== 1 ? 's' : ''} successfully
                </span>
              </div>
            </div>
          )}

          {/* Processing state */}
          {isProcessing && !result && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Updating references...</span>
              </div>
            </div>
          )}

          {/* Affected files list */}
          {affectedFiles.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Files with references to update ({totalRefs} total)
              </h3>
              <div className="space-y-1">
                {affectedFiles.map((file, index) => {
                  const filePath = file.path || file.filePath || file
                  const isExpanded = expanded[filePath]
                  const refs = file.references || []

                  return (
                    <div
                      key={index}
                      className="border border-[var(--border-primary)] rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => refs.length > 0 && toggleExpanded(filePath)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-secondary)] transition-colors text-left"
                      >
                        {refs.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                        <FileText className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                        <span className="text-sm text-[var(--text-primary)] truncate flex-1">
                          {file.title || getRelativePath(filePath)}
                        </span>
                        {refs.length > 0 && (
                          <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                            {refs.length}
                          </span>
                        )}
                        {result?.files?.includes(filePath) && (
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                        )}
                      </button>

                      {isExpanded && refs.length > 0 && (
                        <div className="px-3 pb-2 pt-1 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]/30">
                          <p className="text-xs text-[var(--text-tertiary)] mb-1.5">
                            {getRelativePath(filePath)}
                          </p>
                          <div className="space-y-1">
                            {refs.slice(0, 5).map((ref, idx) => (
                              <div
                                key={idx}
                                className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded truncate"
                              >
                                {ref.fullMatch || ref}
                              </div>
                            ))}
                            {refs.length > 5 && (
                              <p className="text-xs text-[var(--text-tertiary)] italic">
                                +{refs.length - 5} more...
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : !result && (
            <div className="text-center py-6 text-[var(--text-secondary)]">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)]" />
              <p className="text-sm">No references found to update</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]/30">
          <p className="text-xs text-[var(--text-tertiary)]">
            {!result && !isProcessing && (
              <>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)]">Enter</kbd>
                {' '}to update{' '}
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)]">Esc</kbd>
                {' '}to skip
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {result ? (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={() => onConfirm(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  ref={confirmBtnRef}
                  onClick={() => onConfirm(true)}
                  disabled={isProcessing || affectedFiles.length === 0}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>Update References</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
