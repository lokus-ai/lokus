import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';
import { searchPluginKey } from '../core/search/index.js';
import { TextSelection } from '@tiptap/pm/state';

const InFileSearch = ({ 
  editor, 
  isOpen, 
  onClose, 
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [options, setOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    regex: false
  });
  const [matches, setMatches] = useState([]);

  const searchInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isOpen]);

  // Search functionality using TipTap search plugin
  const performSearch = useCallback((searchQuery = query, searchOptions = options) => {
    if (!editor || !searchQuery) {
      setTotalMatches(0);
      setCurrentMatch(0);
      setMatches([]);
      // Clear search in editor
      editor.view.dispatch(
        editor.state.tr.setMeta(searchPluginKey, {
          searchTerm: '',
          matches: [],
          currentMatch: 0
        })
      );
      return;
    }

    try {
      // Calculate matches without changing editor state
      const content = editor.state.doc.textContent;
      let searchRegex;

      if (searchOptions.regex) {
        try {
          searchRegex = new RegExp(searchQuery, searchOptions.caseSensitive ? 'g' : 'gi');
        } catch (e) {
          console.warn('Invalid regex pattern:', e);
          return;
        }
      } else {
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = searchOptions.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchRegex = new RegExp(pattern, searchOptions.caseSensitive ? 'g' : 'gi');
      }

      const matchesArray = Array.from(content.matchAll(searchRegex));
      const matchPositions = [];

      // Convert text positions to document positions
      matchesArray.forEach((match, index) => {
        const textPos = match.index;
        const docPos = findDocumentPosition(editor.state.doc, textPos);
        if (docPos !== null) {
          matchPositions.push({
            from: docPos,
            to: docPos + match[0].length,
            text: match[0]
          });
        }
      });

      setMatches(matchPositions);
      setTotalMatches(matchPositions.length);
      
      if (matchPositions.length > 0) {
        setCurrentMatch(1);
        
        // Update search plugin state without causing editor updates
        editor.view.dispatch(
          editor.state.tr.setMeta(searchPluginKey, {
            searchTerm: searchQuery,
            matches: matchPositions,
            currentMatch: 0,
            options: searchOptions
          })
        );

        // Jump to first match
        jumpToMatch(0);
      } else {
        setCurrentMatch(0);
        editor.view.dispatch(
          editor.state.tr.setMeta(searchPluginKey, {
            searchTerm: '',
            matches: [],
            currentMatch: 0
          })
        );
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }, [editor, query, options]);

  // Helper function to convert text position to document position
  const findDocumentPosition = (doc, textOffset) => {
    let currentOffset = 0;
    let position = null;
    
    doc.descendants((node, pos) => {
      if (node.isText) {
        const nodeEnd = currentOffset + node.text.length;
        if (textOffset >= currentOffset && textOffset <= nodeEnd) {
          position = pos + (textOffset - currentOffset);
          return false; // Stop iteration
        }
        currentOffset = nodeEnd;
      }
      return true;
    });
    
    return position;
  };

  // Jump to a specific match without losing focus from search input
  const jumpToMatch = useCallback((matchIndex) => {
    if (!editor || !matches.length || matchIndex >= matches.length) return;

    const match = matches[matchIndex];
    
    // Update search plugin to highlight current match
    editor.view.dispatch(
      editor.state.tr.setMeta(searchPluginKey, {
        currentMatch: matchIndex
      })
    );

    // Create text selection and scroll to match
    const selection = TextSelection.create(editor.state.doc, match.from, match.to);
    const tr = editor.state.tr.setSelection(selection);
    editor.view.dispatch(tr);

    // Scroll to the match position using TipTap's built-in scrolling
    editor.commands.scrollIntoView();
    
    // Don't focus the editor to keep search input focused
  }, [editor, matches]);

  // Navigate to next match
  const nextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const nextIndex = currentMatch >= totalMatches ? 0 : currentMatch;
    const newCurrentMatch = nextIndex + 1;
    setCurrentMatch(newCurrentMatch);
    jumpToMatch(nextIndex);
  }, [currentMatch, totalMatches, jumpToMatch]);

  // Navigate to previous match
  const previousMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const prevIndex = currentMatch <= 1 ? totalMatches - 1 : currentMatch - 2;
    const newCurrentMatch = prevIndex + 1;
    setCurrentMatch(newCurrentMatch);
    jumpToMatch(prevIndex);
  }, [currentMatch, totalMatches, jumpToMatch]);

  // Handle replace current match
  const replace = useCallback(() => {
    if (!editor || totalMatches === 0 || currentMatch === 0) return;
    
    const matchIndex = currentMatch - 1;
    const match = matches[matchIndex];
    
    if (!match) return;

    // Replace the text at the current match position
    const tr = editor.state.tr.replaceWith(match.from, match.to, editor.schema.text(replaceQuery));
    editor.view.dispatch(tr);
    
    // Refresh search results after replacement
    setTimeout(() => performSearch(), 100);
  }, [editor, totalMatches, currentMatch, matches, replaceQuery, performSearch]);

  // Handle replace all matches
  const replaceAll = useCallback(() => {
    if (!editor || totalMatches === 0 || !replaceQuery) return;
    
    // Sort matches in reverse order to maintain correct positions during replacement
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from);
    
    let tr = editor.state.tr;
    
    // Replace all matches from end to start to maintain positions
    sortedMatches.forEach(match => {
      tr = tr.replaceWith(match.from, match.to, editor.schema.text(replaceQuery));
    });
    
    editor.view.dispatch(tr);
    
    // Refresh search results after replacement
    setTimeout(() => performSearch(), 100);
  }, [editor, totalMatches, matches, replaceQuery, performSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'Enter':
          event.preventDefault();
          if (event.shiftKey) {
            previousMatch();
          } else {
            nextMatch();
          }
          break;
        case 'f':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (searchInputRef.current) {
              searchInputRef.current.focus();
              searchInputRef.current.select();
            }
          }
          break;
        case 'h':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setShowReplace(true);
            if (replaceInputRef.current) {
              replaceInputRef.current.focus();
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, nextMatch, previousMatch]);

  // Perform search when query or options change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 150); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [query, options, performSearch]);

  // Clean up search when component closes
  useEffect(() => {
    if (!isOpen && editor) {
      // Clear search when closing
      editor.view.dispatch(
        editor.state.tr.setMeta(searchPluginKey, {
          searchTerm: '',
          matches: [],
          currentMatch: 0
        })
      );
      setQuery('');
      setTotalMatches(0);
      setCurrentMatch(0);
      setMatches([]);
    }
  }, [isOpen, editor]);

  if (!isOpen) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 bg-app-panel border border-app-border rounded-lg shadow-lg min-w-80 p-4 ${className}`}>
      {/* Search Input */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-app-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in file..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent"
          />
        </div>
        
        {/* Match counter */}
        <span className="text-xs text-app-muted whitespace-nowrap">
          {totalMatches > 0 ? `${currentMatch} of ${totalMatches}` : 'No matches'}
        </span>
        
        {/* Navigation buttons */}
        <div className="flex">
          <button
            onClick={previousMatch}
            disabled={totalMatches === 0}
            className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-bg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous match (Shift+Enter)"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={nextMatch}
            disabled={totalMatches === 0}
            className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-bg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next match (Enter)"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-bg"
          title="Close (Escape)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Replace Input (conditional) */}
      {showReplace && (
        <div className="flex items-center gap-2 mb-3">
          <input
            ref={replaceInputRef}
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Replace with..."
            className="flex-1 px-3 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent"
          />
          <button
            onClick={replace}
            disabled={totalMatches === 0}
            className="px-2 py-1 text-xs bg-app-accent text-white rounded hover:bg-app-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Replace
          </button>
          <button
            onClick={replaceAll}
            disabled={totalMatches === 0}
            className="px-2 py-1 text-xs bg-app-accent text-white rounded hover:bg-app-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            All
          </button>
        </div>
      )}

      {/* Search Options */}
      <div className="flex items-center gap-4 text-xs">
        <button
          onClick={() => setOptions(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
          className={`flex items-center gap-1 p-1 rounded transition-colors ${
            options.caseSensitive 
              ? 'text-app-accent bg-app-accent/10' 
              : 'text-app-muted hover:text-app-text'
          }`}
          title="Match case"
        >
          {options.caseSensitive ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
          Aa
        </button>
        
        <button
          onClick={() => setOptions(prev => ({ ...prev, wholeWord: !prev.wholeWord }))}
          className={`flex items-center gap-1 p-1 rounded transition-colors ${
            options.wholeWord 
              ? 'text-app-accent bg-app-accent/10' 
              : 'text-app-muted hover:text-app-text'
          }`}
          title="Whole word"
        >
          {options.wholeWord ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
          Ab
        </button>
        
        <button
          onClick={() => setOptions(prev => ({ ...prev, regex: !prev.regex }))}
          className={`flex items-center gap-1 p-1 rounded transition-colors ${
            options.regex 
              ? 'text-app-accent bg-app-accent/10' 
              : 'text-app-muted hover:text-app-text'
          }`}
          title="Regular expression"
        >
          {options.regex ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
          .*
        </button>
        
        <button
          onClick={() => setShowReplace(!showReplace)}
          className={`p-1 rounded transition-colors ${
            showReplace 
              ? 'text-app-accent bg-app-accent/10' 
              : 'text-app-muted hover:text-app-text'
          }`}
          title="Toggle replace (Ctrl+H)"
        >
          Replace
        </button>
      </div>
    </div>
  );
};

export default InFileSearch;