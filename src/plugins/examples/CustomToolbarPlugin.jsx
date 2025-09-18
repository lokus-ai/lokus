/**
 * CustomToolbarPlugin.js - Custom Toolbar Plugin Example
 * 
 * Demonstrates how to create custom toolbars with various types of controls:
 * - Quick action buttons
 * - Dropdown menus
 * - Input fields
 * - Toggle switches
 * - Progress indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import { uiAPI, PANEL_POSITIONS, PANEL_TYPES } from '../api/UIAPI.js';
import { 
  Save,
  Copy,
  Scissors,
  Clipboard,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Table,
  Settings,
  Palette,
  Type,
  Search,
  Zap,
  ChevronDown,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

// Dropdown component
const Dropdown = ({ trigger, children, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="dropdown-container relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="toolbar-button flex items-center gap-1"
      >
        {trigger}
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {isOpen && (
        <div className={`
          absolute top-full mt-1 bg-app-panel border border-app-border rounded shadow-lg z-50 min-w-32
          ${align === 'right' ? 'right-0' : 'left-0'}
        `}>
          {children}
        </div>
      )}
    </div>
  );
};

// Quick Actions Toolbar
const QuickActionsToolbar = () => {
  const [lastSaved, setLastSaved] = useState(null);

  const handleQuickSave = () => {
    // Emit save event
    const event = new CustomEvent('lokus:save-file');
    window.dispatchEvent(event);
    setLastSaved(new Date());
  };

  const handleCopy = () => {
    document.execCommand('copy');
  };

  const handleCut = () => {
    document.execCommand('cut');
  };

  const handlePaste = () => {
    document.execCommand('paste');
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-app-panel border-b border-app-border">
      <div className="flex items-center gap-1">
        <button
          onClick={handleQuickSave}
          className="toolbar-button"
          title={`Quick Save ${lastSaved ? `(Last: ${lastSaved.toLocaleTimeString()})` : ''}`}
        >
          <Save className="w-4 h-4" />
        </button>
        
        <div className="w-px h-4 bg-app-border" />
        
        <button onClick={handleCut} className="toolbar-button" title="Cut">
          <Scissors className="w-4 h-4" />
        </button>
        <button onClick={handleCopy} className="toolbar-button" title="Copy">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={handlePaste} className="toolbar-button" title="Paste">
          <Clipboard className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-4 bg-app-border" />

      {/* Format dropdown */}
      <Dropdown trigger={<><Type className="w-4 h-4" /> Format</>}>
        <div className="p-1">
          <button className="dropdown-item" onClick={() => document.execCommand('bold')}>
            <Bold className="w-4 h-4" />
            Bold
          </button>
          <button className="dropdown-item" onClick={() => document.execCommand('italic')}>
            <Italic className="w-4 h-4" />
            Italic
          </button>
          <button className="dropdown-item" onClick={() => document.execCommand('underline')}>
            <Underline className="w-4 h-4" />
            Underline
          </button>
        </div>
      </Dropdown>

      {/* Insert dropdown */}
      <Dropdown trigger={<><Zap className="w-4 h-4" /> Insert</>}>
        <div className="p-1">
          <button className="dropdown-item" onClick={() => insertContent('[[]]')}>
            <Link className="w-4 h-4" />
            Wiki Link
          </button>
          <button className="dropdown-item" onClick={() => insertContent('![]()')}>
            <Image className="w-4 h-4" />
            Image
          </button>
          <button className="dropdown-item" onClick={() => insertContent('| | |\n|---|---|\n| | |')}>
            <Table className="w-4 h-4" />
            Table
          </button>
          <button className="dropdown-item" onClick={() => insertContent('```\n\n```')}>
            <Code className="w-4 h-4" />
            Code Block
          </button>
        </div>
      </Dropdown>

      <div className="flex-1" />

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-app-muted" />
        <input
          type="text"
          placeholder="Quick search..."
          className="pl-7 pr-2 py-1 text-xs bg-app-bg border border-app-border rounded w-32 focus:outline-none focus:border-app-accent"
          onChange={(e) => {
            // Implement quick search
            console.log('Quick search:', e.target.value);
          }}
        />
      </div>
    </div>
  );
};

// Formatting Toolbar
const FormattingToolbar = () => {
  const [activeFormats, setActiveFormats] = useState(new Set());

  const formatButtons = [
    { id: 'bold', icon: Bold, command: 'bold', title: 'Bold (Ctrl+B)' },
    { id: 'italic', icon: Italic, command: 'italic', title: 'Italic (Ctrl+I)' },
    { id: 'underline', icon: Underline, command: 'underline', title: 'Underline (Ctrl+U)' },
  ];

  const alignButtons = [
    { id: 'left', icon: AlignLeft, command: 'justifyLeft', title: 'Align Left' },
    { id: 'center', icon: AlignCenter, command: 'justifyCenter', title: 'Align Center' },
    { id: 'right', icon: AlignRight, command: 'justifyRight', title: 'Align Right' },
  ];

  const listButtons = [
    { id: 'ul', icon: List, command: 'insertUnorderedList', title: 'Bullet List' },
    { id: 'ol', icon: ListOrdered, command: 'insertOrderedList', title: 'Numbered List' },
  ];

  const handleFormat = (command) => {
    document.execCommand(command);
    // Update active formats (in real implementation, would check editor state)
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-app-panel border-b border-app-border">
      {/* Text formatting */}
      <div className="flex items-center gap-0.5">
        {formatButtons.map(button => (
          <button
            key={button.id}
            onClick={() => handleFormat(button.command)}
            className={`toolbar-button ${activeFormats.has(button.id) ? 'active' : ''}`}
            title={button.title}
          >
            <button.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-app-border" />

      {/* Alignment */}
      <div className="flex items-center gap-0.5">
        {alignButtons.map(button => (
          <button
            key={button.id}
            onClick={() => handleFormat(button.command)}
            className="toolbar-button"
            title={button.title}
          >
            <button.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-app-border" />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        {listButtons.map(button => (
          <button
            key={button.id}
            onClick={() => handleFormat(button.command)}
            className="toolbar-button"
            title={button.title}
          >
            <button.icon className="w-4 h-4" />
          </button>
        ))}
        <button
          onClick={() => handleFormat('formatBlock')}
          className="toolbar-button"
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1" />

      {/* Font size selector */}
      <select 
        className="text-xs bg-app-bg border border-app-border rounded px-2 py-1 focus:outline-none focus:border-app-accent"
        onChange={(e) => document.execCommand('fontSize', false, e.target.value)}
      >
        <option value="1">8pt</option>
        <option value="2">10pt</option>
        <option value="3" selected>12pt</option>
        <option value="4">14pt</option>
        <option value="5">18pt</option>
        <option value="6">24pt</option>
        <option value="7">36pt</option>
      </select>
    </div>
  );
};

// Theme Switcher Toolbar
const ThemeSwitcherToolbar = () => {
  const [currentTheme, setCurrentTheme] = useState('dark');

  const themes = [
    { id: 'light', name: 'Light', icon: Sun },
    { id: 'dark', name: 'Dark', icon: Moon },
    { id: 'auto', name: 'Auto', icon: Monitor },
  ];

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    // Emit theme change event
    const event = new CustomEvent('theme:change', { detail: themeId });
    window.dispatchEvent(event);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-app-panel border-b border-app-border">
      <Palette className="w-4 h-4 text-app-muted" />
      <span className="text-xs text-app-muted">Theme:</span>
      
      <div className="flex items-center gap-1">
        {themes.map(theme => (
          <button
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className={`
              toolbar-button text-xs px-2 py-1
              ${currentTheme === theme.id ? 'active bg-app-accent text-app-accent-fg' : ''}
            `}
            title={theme.name}
          >
            <theme.icon className="w-3 h-3" />
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-app-border" />

      {/* Color picker */}
      <input
        type="color"
        className="w-6 h-6 rounded border border-app-border cursor-pointer"
        title="Accent Color"
        onChange={(e) => {
          // Apply custom accent color
          document.documentElement.style.setProperty('--accent', e.target.value);
        }}
      />
    </div>
  );
};

// Status Toolbar
const StatusToolbar = () => {
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [saveStatus, setSaveStatus] = useState('saved');

  useEffect(() => {
    // Mock content analysis
    const updateStats = () => {
      const content = document.querySelector('.ProseMirror')?.textContent || '';
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      const reading = Math.ceil(words / 200); // 200 WPM average
      
      setWordCount(words);
      setReadingTime(reading);
    };

    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-between px-2 py-1 bg-app-panel border-t border-app-border text-xs text-app-muted">
      <div className="flex items-center gap-4">
        <span>{wordCount} words</span>
        <span>{readingTime} min read</span>
        <span className={`
          px-2 py-0.5 rounded
          ${saveStatus === 'saved' ? 'text-app-success' : saveStatus === 'saving' ? 'text-app-warning' : 'text-app-danger'}
        `}>
          {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⏳ Saving...' : '⚠ Unsaved'}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <span>Line 1, Col 1</span>
        <span>Markdown</span>
      </div>
    </div>
  );
};

// Utility function to insert content
const insertContent = (content) => {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(content));
  }
};

// Plugin definition
export const CustomToolbarPlugin = {
  id: 'custom-toolbar',
  name: 'Custom Toolbars',
  version: '1.0.0',
  description: 'Provides customizable toolbars for enhanced productivity',
  author: 'Lokus Team',

  activate() {
    console.log('🔧 Activating Custom Toolbar Plugin...');
    
    try {
      // Register quick actions toolbar
      uiAPI.registerToolbar('custom-toolbar', {
        id: 'quick-actions',
        title: 'Quick Actions',
        location: 'main',
        component: QuickActionsToolbar,
        order: 10,
        visible: true
      });

      // Register formatting toolbar
      uiAPI.registerToolbar('custom-toolbar', {
        id: 'formatting',
        title: 'Formatting',
        location: 'editor',
        component: FormattingToolbar,
        order: 20,
        visible: true
      });

      // Register theme switcher toolbar
      uiAPI.registerToolbar('custom-toolbar', {
        id: 'theme-switcher',
        title: 'Theme Switcher',
        location: 'main',
        component: ThemeSwitcherToolbar,
        order: 30,
        visible: false // Hidden by default
      });

      // Register status toolbar
      uiAPI.registerToolbar('custom-toolbar', {
        id: 'status',
        title: 'Status',
        location: 'bottom',
        component: StatusToolbar,
        order: 40,
        visible: true
      });

      // Register commands to toggle toolbars
      uiAPI.registerCommand('custom-toolbar', {
        id: 'toggle-quick-actions',
        title: 'Toggle Quick Actions Toolbar',
        category: 'View',
        handler: () => {
          const toolbar = uiAPI.toolbars.get('custom-toolbar.quick-actions');
          if (toolbar) {
            toolbar.visible = !toolbar.visible;
            uiAPI.emit('toolbar-visibility-changed', { toolbarId: 'custom-toolbar.quick-actions' });
          }
        }
      });

      uiAPI.registerCommand('custom-toolbar', {
        id: 'toggle-formatting',
        title: 'Toggle Formatting Toolbar',
        category: 'View',
        handler: () => {
          const toolbar = uiAPI.toolbars.get('custom-toolbar.formatting');
          if (toolbar) {
            toolbar.visible = !toolbar.visible;
            uiAPI.emit('toolbar-visibility-changed', { toolbarId: 'custom-toolbar.formatting' });
          }
        }
      });

      uiAPI.registerCommand('custom-toolbar', {
        id: 'toggle-theme-switcher',
        title: 'Toggle Theme Switcher Toolbar',
        category: 'View',
        handler: () => {
          const toolbar = uiAPI.toolbars.get('custom-toolbar.theme-switcher');
          if (toolbar) {
            toolbar.visible = !toolbar.visible;
            uiAPI.emit('toolbar-visibility-changed', { toolbarId: 'custom-toolbar.theme-switcher' });
          }
        }
      });

      // Register status bar item
      uiAPI.registerStatusBarItem('custom-toolbar', {
        id: 'toolbar-toggle',
        text: '🔧 Toolbars',
        tooltip: 'Click to customize toolbars',
        alignment: 'right',
        priority: 60,
        command: 'custom-toolbar.toggle-theme-switcher'
      });

      // Add CSS for toolbar styling
      const style = document.createElement('style');
      style.textContent = `
        .toolbar-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          background: transparent;
          border: none;
          color: rgb(var(--text-secondary));
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 150ms ease;
          gap: 0.25rem;
        }
        
        .toolbar-button:hover {
          background: rgb(var(--panel-secondary));
          color: rgb(var(--text));
        }
        
        .toolbar-button.active {
          background: rgb(var(--accent) / 0.2);
          color: rgb(var(--accent));
        }
        
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem;
          text-align: left;
          background: transparent;
          border: none;
          color: rgb(var(--text));
          font-size: 0.75rem;
          cursor: pointer;
          border-radius: 0.25rem;
        }
        
        .dropdown-item:hover {
          background: rgb(var(--panel-secondary));
        }
      `;
      document.head.appendChild(style);

      console.log('✅ Custom Toolbar Plugin activated successfully');
      
    } catch (error) {
      console.error('❌ Failed to activate Custom Toolbar Plugin:', error);
      throw error;
    }
  },

  deactivate() {
    console.log('🔧 Deactivating Custom Toolbar Plugin...');
    
    try {
      uiAPI.unregisterPlugin('custom-toolbar');
      
      // Remove custom styles
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.textContent.includes('.toolbar-button')) {
          style.remove();
        }
      });
      
      console.log('✅ Custom Toolbar Plugin deactivated successfully');
    } catch (error) {
      console.error('❌ Failed to deactivate Custom Toolbar Plugin:', error);
      throw error;
    }
  }
};

export default CustomToolbarPlugin;