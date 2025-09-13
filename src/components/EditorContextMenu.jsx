import React from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuShortcut,
} from './ui/context-menu';
import { 
  Scissors, 
  Copy, 
  Clipboard, 
  MousePointer, 
  RotateCcw, 
  RotateCw, 
  Search, 
  SearchX,
  Zap,
  FileText,
  Download,
  Upload
} from 'lucide-react';

export default function EditorContextMenu({ children, onAction, hasSelection = false, canUndo = false, canRedo = false }) {
  const handleAction = (action, data = {}) => {
    if (onAction) {
      onAction(action, data);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem 
          onClick={() => handleAction('cut')}
          disabled={!hasSelection}
        >
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => handleAction('copy')}
          disabled={!hasSelection}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('paste')}>
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('selectAll')}>
          <MousePointer className="mr-2 h-4 w-4" />
          Select All
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem 
          onClick={() => handleAction('undo')}
          disabled={!canUndo}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Undo
          <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => handleAction('redo')}
          disabled={!canRedo}
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Redo
          <ContextMenuShortcut>⌘⇧Z</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => handleAction('find')}>
          <Search className="mr-2 h-4 w-4" />
          Find
          <ContextMenuShortcut>⌘F</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('findAndReplace')}>
          <SearchX className="mr-2 h-4 w-4" />
          Find and Replace
          <ContextMenuShortcut>⌘⌥F</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Zap className="mr-2 h-4 w-4" />
            Commands
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => handleAction('commandPalette')}>
              Command Palette
              <ContextMenuShortcut>⌘K</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertTable')}>
              Insert Table
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertCodeBlock')}>
              Insert Code Block
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertLink')}>
              Insert Link
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('insertImage')}>
              Insert Image
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => handleAction('exportMarkdown')}>
          <Download className="mr-2 h-4 w-4" />
          Export as Markdown
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('exportHTML')}>
          <FileText className="mr-2 h-4 w-4" />
          Export as HTML
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('importFile')}>
          <Upload className="mr-2 h-4 w-4" />
          Import File...
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}