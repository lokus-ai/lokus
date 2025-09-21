import { useState, useEffect, useRef } from "react";
import { Bug, Copy, Clipboard, RotateCcw, Search, Settings, HelpCircle } from "lucide-react";

export default function GlobalContextMenu({ 
  isOpen, 
  position, 
  onClose, 
  targetElement,
  contextType = "default" // "editor", "file", "sidebar", "default"
}) {
  const menuRef = useRef(null);
  
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleInspectElement = () => {
    if (targetElement) {
      // Store the element globally
      window.$0 = targetElement;
      window.$lokusElement = targetElement;
      
      // Highlight the element
      const originalOutline = targetElement.style.outline;
      targetElement.style.outline = '2px solid #ff0080';
      
      // Open console with element details
      console.clear();
      console.log('%c🔍 ELEMENT INSPECTOR', 'color: #ff0080; font-size: 14px; font-weight: bold;');
      console.log('Selected element:', targetElement);
      console.log('Available as $0 and $lokusElement');
      
      if (typeof window.inspect === 'function') {
        window.inspect(targetElement);
      }
      
      // Show instructions
      alert('Element highlighted and logged to console.\n\nTo properly inspect:\n1. Hold SHIFT + Right-click for browser\'s inspect menu\n2. Or press F12 to open DevTools\n3. Element is available as $0 in console');
      
      // Remove highlight
      setTimeout(() => {
        targetElement.style.outline = originalOutline;
      }, 3000);
    }
    
    onClose();
  };

  const handleCopyElementInfo = () => {
    if (targetElement) {
      const info = {
        tagName: targetElement.tagName,
        className: targetElement.className,
        id: targetElement.id,
        textContent: targetElement.textContent?.substring(0, 100),
        attributes: Array.from(targetElement.attributes || []).map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      };
      
      navigator.clipboard.writeText(JSON.stringify(info, null, 2));
      console.log('📋 Copied element info:', info);
    }
    onClose();
  };

  const handleReload = () => {
    window.location.reload();
    onClose();
  };

  const handleClearConsole = () => {
    console.clear();
    console.log('🧹 Console cleared');
    onClose();
  };

  if (!isOpen) return null;

  // Adjust menu position to stay within viewport
  const adjustedPosition = { ...position };
  const menuWidth = 200;
  const menuHeight = 250;
  
  if (position.x + menuWidth > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - menuWidth - 10;
  }
  
  if (position.y + menuHeight > window.innerHeight) {
    adjustedPosition.y = window.innerHeight - menuHeight - 10;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg shadow-xl border min-w-48"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: 'rgb(var(--panel))',
        borderColor: 'rgb(var(--border))',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}
    >
      <div className="py-2">
        {/* Browser-like Context Menu Items */}
        <button
          onClick={() => {
            document.execCommand('cut');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Copy className="w-4 h-4" />
          Cut
        </button>

        <button
          onClick={() => {
            document.execCommand('copy');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>

        <button
          onClick={() => {
            document.execCommand('paste');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Clipboard className="w-4 h-4" />
          Paste
        </button>

        <button
          onClick={() => {
            document.execCommand('selectAll');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Search className="w-4 h-4" />
          Select All
        </button>

        {/* Divider */}
        <div className="h-px bg-gray-600 my-2 mx-4"></div>

        <button
          onClick={() => {
            document.execCommand('undo');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <RotateCcw className="w-4 h-4" />
          Undo
        </button>

        <button
          onClick={() => {
            document.execCommand('redo');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <RotateCcw className="w-4 h-4" />
          Redo
        </button>

        {/* Divider */}
        <div className="h-px bg-gray-600 my-2 mx-4"></div>

        <button
          onClick={() => {
            const searchQuery = window.getSelection().toString() || 'find';
            if (document.querySelector('[data-find-dialog]')) {
              document.querySelector('[data-find-dialog]').click();
            } else if (window.find) {
              window.find(searchQuery);
            }
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Search className="w-4 h-4" />
          Find
        </button>

        <button
          onClick={() => {
            // Trigger find and replace functionality
            console.log('🔍 Find and Replace triggered');
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Search className="w-4 h-4" />
          Find and Replace
        </button>

        {/* Divider */}
        <div className="h-px bg-gray-600 my-2 mx-4"></div>

        {/* Developer Tools */}
        <button
          onClick={handleInspectElement}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-opacity-10 transition-colors"
          style={{ 
            color: 'rgb(var(--text))',
            ':hover': { backgroundColor: 'rgb(var(--accent) / 0.1)' }
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Bug className="w-4 h-4" />
          Inspect Element
        </button>

        <button
          onClick={handleCopyElementInfo}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-opacity-10 transition-colors"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Clipboard className="w-4 h-4" />
          Copy Element Info
        </button>

        <button
          onClick={handleClearConsole}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <RotateCcw className="w-4 h-4" />
          Clear Console
        </button>

        <button
          onClick={handleReload}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <RotateCcw className="w-4 h-4" />
          Reload Page
        </button>

        {/* Divider */}
        <div className="h-px bg-gray-600 my-2 mx-4"></div>

        {/* Keyboard Shortcuts */}
        <button
          onClick={() => {
            console.log('⌨️ Opening keyboard shortcuts');
            window.dispatchEvent(new CustomEvent('lokus:shortcut-help'));
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-2 text-sm"
          style={{ color: 'rgb(var(--text))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <HelpCircle className="w-4 h-4" />
          Keyboard Shortcuts
        </button>
      </div>
    </div>
  );
}