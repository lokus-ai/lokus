import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, ChevronUp, ChevronDown, Replace, ToggleLeft } from 'lucide-react'
import { TextSelection } from '@tiptap/pm/state'

export default function InFileSearch({ editor, isVisible, onClose }) {
  const [query, setQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [currentMatch, setCurrentMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  
  const searchInputRef = useRef(null)
  const replaceInputRef = useRef(null)

  // Focus search input when panel becomes visible
  useEffect(() => {
    if (isVisible && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isVisible])


  // Perform search
  const performSearch = useCallback(() => {
    if (!editor || !query.trim()) {
      setMatches([])
      setTotalMatches(0)
      setCurrentMatch(0)
      return
    }

    try {
      const content = editor.state.doc.textContent
      let flags = 'g'
      if (!caseSensitive) flags += 'i'
      
      let pattern = query
      if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      }
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`
      }

      const regex = new RegExp(pattern, flags)
      const foundMatches = []
      let match

      while ((match = regex.exec(content)) !== null) {
        const from = match.index
        const to = match.index + match[0].length
        foundMatches.push({ from, to, text: match[0] })
        
        // Prevent infinite loop with zero-length matches
        if (match[0].length === 0) break
      }

      setMatches(foundMatches)
      setTotalMatches(foundMatches.length)
      
      if (foundMatches.length > 0) {
        setCurrentMatch(0)
        jumpToMatch(0, foundMatches)
      } else {
        setCurrentMatch(0)
      }
    } catch (error) {
      setMatches([])
      setTotalMatches(0)
      setCurrentMatch(0)
    }
  }, [editor, query, caseSensitive, wholeWord, useRegex])

  // Jump to a specific match
  const jumpToMatch = useCallback((matchIndex, matchList = matches) => {
    if (!editor || !matchList.length) return

    const match = matchList[matchIndex]
    if (!match) return

    try {
      const selection = TextSelection.create(editor.state.doc, match.from, match.to)
      const tr = editor.state.tr.setSelection(selection)
      editor.view.dispatch(tr)
      editor.commands.scrollIntoView()
    } catch (error) {
    }
  }, [editor, matches])

  // Navigate to next match
  const nextMatch = useCallback(() => {
    if (totalMatches === 0) return
    const next = (currentMatch + 1) % totalMatches
    setCurrentMatch(next)
    jumpToMatch(next)
  }, [currentMatch, totalMatches, jumpToMatch])

  // Navigate to previous match
  const prevMatch = useCallback(() => {
    if (totalMatches === 0) return
    const prev = currentMatch === 0 ? totalMatches - 1 : currentMatch - 1
    setCurrentMatch(prev)
    jumpToMatch(prev)
  }, [currentMatch, totalMatches, jumpToMatch])

  // Replace current match
  const replace = useCallback(() => {
    if (!editor || !matches.length || !replaceQuery) return

    const match = matches[currentMatch]
    if (!match) return

    try {
      const tr = editor.state.tr.replaceWith(match.from, match.to, editor.schema.text(replaceQuery))
      editor.view.dispatch(tr)
      
      // Re-search after replacing
      setTimeout(() => performSearch(), 100)
    } catch (error) {
    }
  }, [editor, matches, currentMatch, replaceQuery, performSearch])

  // Replace all matches
  const replaceAll = useCallback(() => {
    if (!editor || !matches.length || !replaceQuery) return

    try {
      let tr = editor.state.tr
      // Replace from end to start to maintain positions
      const reversedMatches = [...matches].reverse()
      
      for (const match of reversedMatches) {
        tr = tr.replaceWith(match.from, match.to, editor.schema.text(replaceQuery))
      }
      
      editor.view.dispatch(tr)
      
      // Re-search after replacing
      setTimeout(() => performSearch(), 100)
    } catch (error) {
    }
  }, [editor, matches, replaceQuery, performSearch])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        prevMatch()
      } else {
        nextMatch()
      }
    } else if (e.key === 'F3') {
      e.preventDefault()
      if (e.shiftKey) {
        prevMatch()
      } else {
        nextMatch()
      }
    }
  }, [onClose, nextMatch, prevMatch])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [performSearch])

  if (!isVisible) return null

  return (
    <div className="fixed top-0 right-0 z-50 bg-app-bg border border-app-border shadow-lg p-3 min-w-80">
      <div className="flex flex-col gap-2">
        {/* Search input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find in file..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-app-bg border border-app-border rounded focus:outline-none focus:ring-1 focus:ring-app-primary"
            />
          </div>
          
          {/* Match counter */}
          {query.trim() && (
            <span className="text-xs text-app-muted whitespace-nowrap">
              {totalMatches > 0 ? `${currentMatch + 1} of ${totalMatches}` : 'No matches'}
            </span>
          )}
          
          {/* Navigation buttons */}
          <button
            onClick={prevMatch}
            disabled={totalMatches === 0}
            title="Previous match (Shift+Enter)"
            className="p-1 rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          
          <button
            onClick={nextMatch}
            disabled={totalMatches === 0}
            title="Next match (Enter)"
            className="p-1 rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {/* Toggle replace button */}
          <button
            onClick={() => setShowReplace(!showReplace)}
            title="Toggle replace (Ctrl+H)"
            className={`p-1 rounded hover:bg-app-hover ${showReplace ? 'bg-app-hover' : ''}`}
          >
            <Replace className="w-4 h-4" />
          </button>
          
          {/* Close button */}
          <button
            onClick={onClose}
            title="Close (Escape)"
            className="p-1 rounded hover:bg-app-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Replace input row */}
        {showReplace && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Replace className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-muted" />
              <input
                ref={replaceInputRef}
                type="text"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-app-bg border border-app-border rounded focus:outline-none focus:ring-1 focus:ring-app-primary"
              />
            </div>
            
            <button
              onClick={replace}
              disabled={totalMatches === 0 || !replaceQuery}
              title="Replace current match"
              className="px-2 py-1 text-xs rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace
            </button>
            
            <button
              onClick={replaceAll}
              disabled={totalMatches === 0 || !replaceQuery}
              title="Replace all matches"
              className="px-2 py-1 text-xs rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              All
            </button>
          </div>
        )}

        {/* Search options */}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1 cursor-pointer hover:text-app-primary">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3"
            />
            <span title="Match case">Aa</span>
          </label>
          
          <label className="flex items-center gap-1 cursor-pointer hover:text-app-primary">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              className="w-3 h-3"
            />
            <span title="Whole word">ab</span>
          </label>
          
          <label className="flex items-center gap-1 cursor-pointer hover:text-app-primary">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              className="w-3 h-3"
            />
            <span title="Regular expression">.*</span>
          </label>
        </div>

        {/* No matches message */}
        {query && totalMatches === 0 && (
          <div className="text-xs text-app-muted">No matches found</div>
        )}
      </div>
    </div>
  )
}