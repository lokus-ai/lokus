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
  FolderOpen, 
  Eye, 
  Terminal, 
  Share2, 
  GitCompare, 
  Scissors, 
  Copy, 
  FileText, 
  Edit3, 
  Trash2,
  ExternalLink
} from 'lucide-react';

export default function FileContextMenu({ children, file, onAction }) {
  const isFile = file?.type === 'file';
  const isFolder = file?.type === 'folder';

  const handleAction = (action, data = {}) => {
    if (onAction) {
      onAction(action, { ...data, file });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {isFile && (
          <>
            <ContextMenuItem onClick={() => handleAction('open')}>
              <FileText className="mr-2 h-4 w-4" />
              Open
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('openToSide')}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open to the Side
              <ContextMenuShortcut>⌘⇧Enter</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('openWith')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open With...
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        
        <ContextMenuItem onClick={() => handleAction('revealInFinder')}>
          <Eye className="mr-2 h-4 w-4" />
          Reveal in Finder
          <ContextMenuShortcut>⌥⌘R</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('openInTerminal')}>
          <Terminal className="mr-2 h-4 w-4" />
          Open in Integrated Terminal
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => handleAction('shareEmail')}>
              Email Link
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('shareSlack')}>
              Copy Link for Slack
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAction('shareTeams')}>
              Copy Link for Teams
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        {isFile && (
          <ContextMenuItem onClick={() => handleAction('selectForCompare')}>
            <GitCompare className="mr-2 h-4 w-4" />
            Select for Compare
          </ContextMenuItem>
        )}
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => handleAction('cut')}>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('copy')}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('copyPath')}>
          <FileText className="mr-2 h-4 w-4" />
          Copy Path
          <ContextMenuShortcut>⌥⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => handleAction('copyRelativePath')}>
          <FileText className="mr-2 h-4 w-4" />
          Copy Relative Path
          <ContextMenuShortcut>⌥⌘⇧C</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => handleAction('rename')}>
          <Edit3 className="mr-2 h-4 w-4" />
          Rename...
          <ContextMenuShortcut>⌘⇧R</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => handleAction('delete')}
          className="text-[rgb(var(--danger))] focus:text-[rgb(var(--danger))/0.8]"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}