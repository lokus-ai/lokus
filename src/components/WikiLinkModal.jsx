import React, { useState, useEffect, useRef } from 'react'
import { Search, File, Folder, FolderOpen, Clock, ArrowRight, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { joinPath } from '../utils/pathUtils.js'
import platformService from '../services/platform/PlatformService.js'

export default function WikiLinkModal({ 
  isOpen, 
  onClose, 
  onSelectFile, 
  workspacePath,
  currentFile 
}) {
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentFiles, setRecentFiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const searchInputRef = useRef(null)
  const modalRef = useRef(null)

  // Load files from workspace
  useEffect(() => {
    if (!isOpen || !workspacePath) return

    setIsLoading(true)
    loadWorkspaceFiles()
  }, [isOpen, workspacePath])

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = files.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.path.toLowerCase().includes(query)
      ).sort((a, b) => {
        // Sort by relevance: exact match > starts with > contains
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        
        if (aName === query) return -1
        if (bName === query) return 1
        if (aName.startsWith(query)) return -1
        if (bName.startsWith(query)) return 1
        
        return aName.localeCompare(bName)
      })
      setFilteredFiles(filtered)
    }
    setSelectedIndex(0)
  }, [searchQuery, files])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            Math.min(prev + 1, filteredFiles.length - 1)
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredFiles[selectedIndex]) {
            handleSelectFile(filteredFiles[selectedIndex])
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredFiles, selectedIndex, onClose])

  const loadWorkspaceFiles = async () => {
    try {
      const workspaceFiles = await invoke("read_workspace_files", { workspacePath })
      const allFiles = []

      const extractFiles = (entries, path = '') => {
        entries.forEach(entry => {
          if (!entry.is_directory && entry.name.endsWith('.md')) {
            const fullPath = path ? joinPath(path, entry.name) : entry.name
            allFiles.push({
              name: entry.name.replace('.md', ''),
              path: fullPath,
              fullPath,
              relativePath: fullPath,
              isMarkdown: true
            })
          } else if (entry.is_directory && entry.children) {
            const folderPath = path ? joinPath(path, entry.name) : entry.name
            extractFiles(entry.children, folderPath)
          }
        })
      }

      extractFiles(workspaceFiles)
      
      // Remove current file from list
      const filteredFiles = allFiles.filter(file => 
        file.path !== currentFile?.path && file.name !== currentFile?.name
      )

      setFiles(filteredFiles)
      setFilteredFiles(filteredFiles)
    } catch { } finally {
      setIsLoading(false)
    }
  }

  const handleSelectFile = (file) => {
    // Add to recent files
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== file.path)
      return [file, ...filtered].slice(0, 5)
    })

    onSelectFile(file)
    onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl mx-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Search className="w-5 h-5 text-white/60" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-white/60 outline-none text-lg"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Recent Files */}
              {recentFiles.length > 0 && !searchQuery && (
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent Files
                  </h3>
                  <div className="space-y-1">
                    {recentFiles.map((file, index) => (
                      <FileItem
                        key={file.path}
                        file={file}
                        isSelected={false}
                        onClick={() => handleSelectFile(file)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Files */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  {searchQuery ? `Results for "${searchQuery}"` : 'All Files'}
                  <span className="text-xs">({filteredFiles.length})</span>
                </h3>
                
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-8 text-white/60">
                    {searchQuery ? 'No files found' : 'No markdown files in workspace'}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filteredFiles.map((file, index) => (
                      <FileItem
                        key={file.path}
                        file={file}
                        isSelected={index === selectedIndex}
                        onClick={() => handleSelectFile(file)}
                        searchQuery={searchQuery}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 text-xs text-white/60">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>Enter Select</span>
            <span>Esc Close</span>
          </div>
          <div>
            {platformService.getModifierSymbol()}+K to open
          </div>
        </div>
      </div>
    </div>
  )
}

function FileItem({ file, isSelected, onClick, searchQuery }) {
  const getHighlightedText = (text, query) => {
    if (!query) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-500/30 text-yellow-200">
          {part}
        </mark>
      ) : part
    )
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
        isSelected 
          ? 'bg-white/20 border border-white/30' 
          : 'hover:bg-white/10 border border-transparent'
      }`}
    >
      <File className="w-4 h-4 text-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">
          {getHighlightedText(file.name, searchQuery)}
        </div>
        <div className="text-white/60 text-sm truncate">
          {getHighlightedText(file.relativePath, searchQuery)}
        </div>
      </div>
      {isSelected && (
        <ArrowRight className="w-4 h-4 text-white/60 flex-shrink-0" />
      )}
    </button>
  )
}