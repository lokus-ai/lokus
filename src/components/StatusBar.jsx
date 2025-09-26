import React from 'react';
import { useStatusBar } from '../hooks/useStatusBar';
import SyncStatus from './Auth/SyncStatus.jsx';

/**
 * Pluginable Status Bar Component
 * Supports left and right sections with priority-based ordering of widgets
 * Compatible with VS Code-style plugin status bar items
 */
export default function StatusBar({ activeFile, unsavedChanges, openTabs = [] }) {
  const { leftItems, rightItems } = useStatusBar();
  
  // DEBUG: Log status bar items

  const renderStatusBarItem = (item) => {
    const { id, component: Component, text, icon, tooltip, command, priority, className } = item;
    
    
    // If it's a React component, render it directly
    if (Component) {
      // Validate that Component is actually a valid React component
      if (typeof Component === 'function' || (typeof Component === 'object' && Component.$$typeof)) {
        return (
          <div key={id} className="status-bar-plugin-item">
            <Component />
          </div>
        );
      } else {
        return (
          <div key={id} className="status-bar-plugin-item">
            <span className="text-red-500 text-xs">Invalid Component</span>
          </div>
        );
      }
    }
    
    // Otherwise render as a basic status bar item
    return (
      <div 
        key={id}
        className={`obsidian-status-bar-item ${command ? 'clickable' : ''} ${className || ''}`}
        title={tooltip}
        onClick={command ? () => handleCommand(command) : undefined}
      >
        {icon && <span className="w-3 h-3 mr-1">{icon}</span>}
        {text && <span>{text}</span>}
      </div>
    );
  };

  const handleCommand = (command) => {
    // Execute command through plugin system
    if (typeof window !== 'undefined' && window.pluginRuntime) {
      window.pluginRuntime.executeCommand(command);
    }
  };

  // Sort items by priority (higher priority first)
  const sortedLeftItems = [...leftItems].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const sortedRightItems = [...rightItems].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <div className="obsidian-status-bar">
      {/* Left section - plugin items and core items */}
      <div className="obsidian-status-bar-section">
        {/* Core status items */}
        <div className="obsidian-status-bar-item">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Ready</span>
        </div>
        
        {activeFile && (
          <>
            <div className="obsidian-status-bar-separator" />
            <div className="obsidian-status-bar-item">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span>{activeFile.split('/').pop()}</span>
            </div>
          </>
        )}
        
        <div className="obsidian-status-bar-separator" />
        <div className="obsidian-status-bar-item">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <span>{openTabs.length} {openTabs.length === 1 ? 'file' : 'files'}</span>
        </div>

        {/* Plugin items in left section */}
        {sortedLeftItems.length > 0 && (
          <>
            <div className="obsidian-status-bar-separator" />
            {sortedLeftItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <div className="obsidian-status-bar-separator" />}
                {renderStatusBarItem(item)}
              </React.Fragment>
            ))}
          </>
        )}
      </div>
      
      {/* Right section - plugin items and core items */}
      <div className="obsidian-status-bar-section">
        {/* Plugin items in right section */}
        {sortedRightItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderStatusBarItem(item)}
            {index < sortedRightItems.length - 1 && <div className="obsidian-status-bar-separator" />}
          </React.Fragment>
        ))}
        
        {/* Core status items */}
        {(sortedRightItems.length > 0 || unsavedChanges.size > 0) && (
          <div className="obsidian-status-bar-separator" />
        )}
        
        {unsavedChanges.size > 0 && (
          <>
            <div className="obsidian-status-bar-item active">
              <div className="w-2 h-2 rounded-full bg-current" />
              <span>{unsavedChanges.size} unsaved</span>
            </div>
            <div className="obsidian-status-bar-separator" />
          </>
        )}
        
        <div className="obsidian-status-bar-item clickable">
          <span>Markdown</span>
        </div>
        <div className="obsidian-status-bar-separator" />
        <div className="obsidian-status-bar-item clickable">
          <span>UTF-8</span>
        </div>
        <div className="obsidian-status-bar-separator" />
        <div className="obsidian-status-bar-item clickable">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          <span>Settings</span>
        </div>
        
        {/* Sync Component */}
        <div className="obsidian-status-bar-separator" />
        <SyncStatus />
      </div>
    </div>
  );
}