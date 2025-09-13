// Search utilities for Lokus editor
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const searchPluginKey = new PluginKey('search');

// Create search decorations for highlighting matches
export const createSearchDecorations = (doc, searchTerm, options = {}) => {
  const {
    caseSensitive = false,
    wholeWord = false,
    regex = false,
    currentMatchIndex = 0
  } = options;

  if (!searchTerm) return DecorationSet.empty;

  const decorations = [];
  let searchRegex;

  try {
    if (regex) {
      searchRegex = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
      searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }
  } catch (error) {
    console.warn('Invalid search pattern:', error);
    return DecorationSet.empty;
  }

  const text = doc.textContent;
  let match;
  let matchIndex = 0;

  while ((match = searchRegex.exec(text)) !== null) {
    const from = match.index;
    const to = match.index + match[0].length;
    
    // Find the actual position in the document
    const pos = findPositionInDoc(doc, from);
    const endPos = findPositionInDoc(doc, to);
    
    if (pos !== null && endPos !== null) {
      const isCurrentMatch = matchIndex === currentMatchIndex;
      const className = isCurrentMatch ? 'search-match-current' : 'search-match';
      
      decorations.push(
        Decoration.inline(pos, endPos, {
          class: className,
          'data-match-index': matchIndex
        })
      );
      
      matchIndex++;
    }
    
    // Prevent infinite loop with zero-width matches
    if (match[0].length === 0) {
      searchRegex.lastIndex++;
    }
  }

  return DecorationSet.create(doc, decorations);
};

// Find position in ProseMirror document from text offset
const findPositionInDoc = (doc, textOffset) => {
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

// Create search plugin for TipTap
export const createSearchPlugin = () => {
  return new Plugin({
    key: searchPluginKey,
    state: {
      init() {
        return {
          searchTerm: '',
          matches: [],
          currentMatch: 0,
          options: {
            caseSensitive: false,
            wholeWord: false,
            regex: false
          }
        };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(searchPluginKey);
        if (meta) {
          return { ...prev, ...meta };
        }
        return prev;
      }
    },
    props: {
      decorations(state) {
        const { searchTerm, currentMatch, options } = searchPluginKey.getState(state);
        if (!searchTerm) return DecorationSet.empty;
        
        return createSearchDecorations(
          state.doc, 
          searchTerm, 
          { ...options, currentMatchIndex: currentMatch }
        );
      }
    }
  });
};

// Search commands for editor integration
export const searchCommands = {
  setSearchTerm: (searchTerm, options = {}) => ({ tr, dispatch }) => {
    if (dispatch) {
      tr.setMeta(searchPluginKey, { 
        searchTerm, 
        options,
        currentMatch: 0 
      });
    }
    return true;
  },
  
  clearSearch: () => ({ tr, dispatch }) => {
    if (dispatch) {
      tr.setMeta(searchPluginKey, { 
        searchTerm: '',
        matches: [],
        currentMatch: 0 
      });
    }
    return true;
  },
  
  nextMatch: () => ({ state, tr, dispatch }) => {
    const searchState = searchPluginKey.getState(state);
    const { matches, currentMatch } = searchState;
    
    if (matches.length === 0) return false;
    
    const nextMatch = currentMatch >= matches.length - 1 ? 0 : currentMatch + 1;
    
    if (dispatch) {
      tr.setMeta(searchPluginKey, { currentMatch: nextMatch });
    }
    
    return true;
  },
  
  previousMatch: () => ({ state, tr, dispatch }) => {
    const searchState = searchPluginKey.getState(state);
    const { matches, currentMatch } = searchState;
    
    if (matches.length === 0) return false;
    
    const prevMatch = currentMatch <= 0 ? matches.length - 1 : currentMatch - 1;
    
    if (dispatch) {
      tr.setMeta(searchPluginKey, { currentMatch: prevMatch });
    }
    
    return true;
  }
};

// Utility functions
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export const highlightText = (text, searchTerm, options = {}) => {
  if (!searchTerm) return text;
  
  const {
    caseSensitive = false,
    wholeWord = false,
    regex = false
  } = options;

  let searchRegex;
  
  try {
    if (regex) {
      searchRegex = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
      searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }
    
    return text.replace(searchRegex, '<mark class="search-highlight">$&</mark>');
  } catch (error) {
    console.warn('Error highlighting text:', error);
    return text;
  }
};

// Global search utilities for file-based searching
export const searchInFiles = async (query, files, options = {}) => {
  const {
    caseSensitive = false,
    wholeWord = false,
    regex = false,
    maxResults = 100,
    contextLines = 3
  } = options;

  const results = [];
  let searchRegex;

  try {
    if (regex) {
      searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
      searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }
  } catch (error) {
    console.warn('Invalid search pattern:', error);
    return [];
  }

  for (const file of files) {
    if (results.length >= maxResults) break;
    
    try {
      const content = await file.getContent(); // Assume files have getContent method
      const lines = content.split('\n');
      const fileMatches = [];

      lines.forEach((line, lineIndex) => {
        if (searchRegex.test(line)) {
          const matches = Array.from(line.matchAll(searchRegex));
          matches.forEach(match => {
            fileMatches.push({
              line: lineIndex + 1,
              column: match.index,
              text: line,
              match: match[0],
              context: getContextLines(lines, lineIndex, contextLines)
            });
          });
        }
      });

      if (fileMatches.length > 0) {
        results.push({
          file: file.path,
          fileName: file.name,
          matches: fileMatches,
          matchCount: fileMatches.length
        });
      }
    } catch (error) {
      console.warn(`Error searching in file ${file.path}:`, error);
    }
  }

  return results;
};

// Get context lines around a match
const getContextLines = (lines, targetLine, contextLines) => {
  const start = Math.max(0, targetLine - contextLines);
  const end = Math.min(lines.length - 1, targetLine + contextLines);
  
  return lines.slice(start, end + 1).map((line, index) => ({
    lineNumber: start + index + 1,
    text: line,
    isMatch: start + index === targetLine
  }));
};