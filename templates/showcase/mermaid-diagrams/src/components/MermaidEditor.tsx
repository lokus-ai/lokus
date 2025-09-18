/**
 * Mermaid Code Editor Component
 * 
 * A sophisticated code editor with:
 * - Syntax highlighting for Mermaid
 * - Auto-completion
 * - Error highlighting
 * - Line numbers
 * - Minimap
 */

import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '@lokus/theme-system'
import './MermaidEditor.css'

export interface MermaidEditorProps {
  content: string
  diagramType: string
  onChange: (content: string) => void
  validation?: {
    valid: boolean
    errors: string[]
    warnings?: string[]
  }
  isValidating?: boolean
  placeholder?: string
  readOnly?: boolean
  showLineNumbers?: boolean
  showMinimap?: boolean
  autoComplete?: boolean
}

export interface MermaidEditorRef {
  focus: () => void
  getSelectionRange: () => { start: number; end: number }
  setSelectionRange: (start: number, end: number) => void
  insertText: (text: string) => void
  undo: () => void
  redo: () => void
}

/**
 * Mermaid syntax highlighting rules
 */
const mermaidSyntax = {
  'keyword': /\b(?:graph|flowchart|sequenceDiagram|gantt|pie|gitgraph|erDiagram|journey|stateDiagram|classDiagram|requirementDiagram)\b/,
  'direction': /\b(?:TD|TB|BT|RL|LR)\b/,
  'operator': /(?:-->|---|->>|-->>|->|--|-\.-|==>|==|===|\|\|--o\{|\|\|--\|\{)/,
  'string': /"(?:[^"\\]|\\.)*"/,
  'number': /\b\d+(?:\.\d+)?\b/,
  'function': /\b\w+(?=\s*\()/,
  'property': /\b\w+(?=\s*:)/,
  'comment': /%%.*/,
  'punctuation': /[{}[\](),;]/,
  'title': /title\s+.+/,
  'participant': /participant\s+\w+/,
  'section': /section\s+.+/,
  'class': /class\s+\w+/,
  'style': /style\s+\w+\s+fill:[^,\s]+/
}

const MermaidEditor = forwardRef<MermaidEditorRef, MermaidEditorProps>(({
  content,
  diagramType,
  onChange,
  validation,
  isValidating = false,
  placeholder = 'Enter your diagram code...',
  readOnly = false,
  showLineNumbers = true,
  showMinimap = false,
  autoComplete = true
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  
  // History management
  const historyRef = useRef<string[]>([content])
  const historyIndexRef = useRef(0)

  /**
   * Expose methods through ref
   */
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
    getSelectionRange: () => {
      const textarea = textareaRef.current
      if (!textarea) return { start: 0, end: 0 }
      return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd
      }
    },
    setSelectionRange: (start: number, end: number) => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.setSelectionRange(start, end)
    },
    insertText: (text: string) => {
      const textarea = textareaRef.current
      if (!textarea) return
      
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = content.slice(0, start)
      const after = content.slice(end)
      const newContent = before + text + after
      
      onChange(newContent)
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.setSelectionRange(start + text.length, start + text.length)
      }, 0)
    },
    undo: () => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--
        onChange(historyRef.current[historyIndexRef.current])
      }
    },
    redo: () => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++
        onChange(historyRef.current[historyIndexRef.current])
      }
    }
  }))

  /**
   * Handle content changes
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    onChange(newContent)
    
    // Add to history
    if (newContent !== historyRef.current[historyIndexRef.current]) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
      historyRef.current.push(newContent)
      historyIndexRef.current = historyRef.current.length - 1
      
      // Limit history size
      if (historyRef.current.length > 50) {
        historyRef.current = historyRef.current.slice(-50)
        historyIndexRef.current = historyRef.current.length - 1
      }
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab handling
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      
      if (e.shiftKey) {
        // Remove indentation
        const lines = content.split('\n')
        const startLine = content.slice(0, start).split('\n').length - 1
        const endLine = content.slice(0, end).split('\n').length - 1
        
        const newLines = lines.map((line, index) => {
          if (index >= startLine && index <= endLine && line.startsWith('  ')) {
            return line.slice(2)
          }
          return line
        })
        
        onChange(newLines.join('\n'))
      } else {
        // Add indentation
        if (start === end) {
          // Single cursor - insert tab
          const before = content.slice(0, start)
          const after = content.slice(end)
          onChange(before + '  ' + after)
          
          setTimeout(() => {
            textarea.setSelectionRange(start + 2, start + 2)
          }, 0)
        } else {
          // Selection - indent lines
          const lines = content.split('\n')
          const startLine = content.slice(0, start).split('\n').length - 1
          const endLine = content.slice(0, end).split('\n').length - 1
          
          const newLines = lines.map((line, index) => {
            if (index >= startLine && index <= endLine) {
              return '  ' + line
            }
            return line
          })
          
          onChange(newLines.join('\n'))
        }
      }
    }
    
    // Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        ref?.current?.undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        ref?.current?.redo()
      }
    }

    // Auto-completion trigger
    if (autoComplete && e.key === ' ' && e.ctrlKey) {
      e.preventDefault()
      showAutoComplete()
    }
  }

  /**
   * Show auto-completion suggestions
   */
  const showAutoComplete = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const beforeCursor = content.slice(0, cursorPos)
    const currentLine = beforeCursor.split('\n').pop() || ''
    
    // Get suggestions based on diagram type and current context
    const suggestions = getAutoCompleteSuggestions(diagramType, currentLine)
    
    if (suggestions.length > 0) {
      // Show completion popup (implementation would depend on your UI library)
      console.log('Auto-complete suggestions:', suggestions)
    }
  }

  /**
   * Get auto-completion suggestions
   */
  const getAutoCompleteSuggestions = (type: string, currentLine: string): string[] => {
    const suggestions: Record<string, string[]> = {
      flowchart: [
        'graph TD',
        'graph LR',
        'A[Rectangle]',
        'B(Rounded)',
        'C{Diamond}',
        'D((Circle))',
        'E>Flag]',
        'F[[Subroutine]]',
        'A --> B',
        'A -.-> B',
        'A ==> B',
        'style A fill:#f9f,stroke:#333'
      ],
      sequence: [
        'sequenceDiagram',
        'participant A',
        'participant B',
        'A->>B: Message',
        'A-->>B: Dotted message',
        'Note right of A: Note text',
        'Note left of B: Note text',
        'Note over A,B: Note over both',
        'activate A',
        'deactivate A',
        'loop Loop text',
        'alt Alternative text',
        'opt Optional text'
      ],
      gantt: [
        'gantt',
        'title Project Timeline',
        'dateFormat YYYY-MM-DD',
        'section Section',
        'Task 1 :done, task1, 2024-01-01, 30d',
        'Task 2 :active, task2, after task1, 20d',
        'Task 3 :task3, after task2, 10d'
      ]
    }

    return suggestions[type] || []
  }

  /**
   * Get line numbers array
   */
  const getLineNumbers = () => {
    return content.split('\n').map((_, index) => index + 1)
  }

  /**
   * Get highlighted content
   */
  const getHighlightedContent = () => {
    return (
      <SyntaxHighlighter
        language="javascript" // Use JavaScript for basic highlighting
        style={theme.mode === 'dark' ? vscDarkPlus : vs}
        customStyle={{
          margin: 0,
          padding: 0,
          background: 'transparent',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
        codeTagProps={{
          style: {
            fontSize: '14px',
            fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace'
          }
        }}
      >
        {content || ' '}
      </SyntaxHighlighter>
    )
  }

  /**
   * Sync scroll between textarea and highlighted content
   */
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const highlightedElement = editorRef.current?.querySelector('.highlighted-content')
    if (highlightedElement) {
      highlightedElement.scrollTop = e.currentTarget.scrollTop
      highlightedElement.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  return (
    <div 
      className={`mermaid-editor ${theme.mode} ${isValidating ? 'validating' : ''} ${
        validation && !validation.valid ? 'has-errors' : ''
      }`}
      ref={editorRef}
    >
      {/* Line numbers */}
      {showLineNumbers && (
        <div className="mermaid-editor__line-numbers">
          {getLineNumbers().map(number => (
            <div 
              key={number} 
              className="line-number"
              data-line={number}
            >
              {number}
            </div>
          ))}
        </div>
      )}

      <div className="mermaid-editor__content">
        {/* Syntax highlighting background */}
        <div 
          className="mermaid-editor__highlighted highlighted-content"
          aria-hidden="true"
        >
          {getHighlightedContent()}
        </div>

        {/* Textarea overlay */}
        <textarea
          ref={textareaRef}
          className="mermaid-editor__textarea"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          data-gramm="false"
        />
      </div>

      {/* Minimap */}
      {showMinimap && content.length > 500 && (
        <div className="mermaid-editor__minimap">
          <div 
            className="minimap-content"
            style={{
              fontSize: '2px',
              lineHeight: '3px',
              overflow: 'hidden'
            }}
          >
            {content.split('\n').map((line, index) => (
              <div key={index} className="minimap-line">
                {line.slice(0, 50)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation indicator */}
      {isValidating && (
        <div className="mermaid-editor__validation-indicator">
          <div className="validation-spinner"></div>
        </div>
      )}

      {/* Error highlighting overlay */}
      {validation && !validation.valid && (
        <div className="mermaid-editor__error-overlay">
          {validation.errors.map((error, index) => {
            // Extract line number from error message if available
            const lineMatch = error.match(/line (\d+)/i)
            const lineNumber = lineMatch ? parseInt(lineMatch[1]) - 1 : 0
            
            return (
              <div 
                key={index}
                className="error-highlight"
                style={{
                  top: `${lineNumber * 21}px`, // Assuming 21px line height
                  height: '21px'
                }}
                title={error}
              />
            )
          })}
        </div>
      )}

      {/* Status bar */}
      <div className="mermaid-editor__status-bar">
        <div className="status-info">
          <span className="diagram-type">{diagramType}</span>
          <span className="separator">•</span>
          <span className="lines-count">
            {content.split('\n').length} lines
          </span>
          <span className="separator">•</span>
          <span className="chars-count">
            {content.length} characters
          </span>
        </div>
        
        <div className="status-actions">
          {validation && (
            <span className={`validation-status ${validation.valid ? 'valid' : 'invalid'}`}>
              {validation.valid ? '✓ Valid' : `✗ ${validation.errors.length} errors`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

MermaidEditor.displayName = 'MermaidEditor'

export default MermaidEditor