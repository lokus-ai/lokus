import React from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from './ui/context-menu';
import {
  Trello,
  FolderOpen,
  Copy,
  Files,
  Pencil,
  Trash2,
  Link,
  Download,
} from 'lucide-react';
import platformService from '../services/platform/PlatformService';
import { isDesktop } from '../platform/index.js';

export default function KanbanContextMenu({
  children,
  board,
  onAction,
}) {
  const isWindows = platformService.isWindows();
  const isMac = platformService.isMacOS();

  const handleAction = (action) => {
    if (onAction) {
      onAction(action, board);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Open */}
        <ContextMenuItem onClick={() => handleAction('open')}>
          <Trello className="mr-2 h-4 w-4" />
          Open Board
          {isDesktop() && (<ContextMenuShortcut>Enter</ContextMenuShortcut>)}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Reveal in Finder */}
        <ContextMenuItem onClick={() => handleAction('revealInFinder')}>
          <FolderOpen className="mr-2 h-4 w-4" />
          {isMac ? 'Reveal in Finder' : isWindows ? 'Reveal in File Explorer' : 'Show in File Manager'}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Copy and Duplicate */}
        <ContextMenuItem onClick={() => handleAction('duplicate')}>
          <Files className="mr-2 h-4 w-4" />
          Duplicate
          {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+D' : '⌘D'}</ContextMenuShortcut>)}
        </ContextMenuItem>

        <ContextMenuItem onClick={() => handleAction('copyPath')}>
          <Link className="mr-2 h-4 w-4" />
          Copy Path
          {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+C' : '⌘⇧C'}</ContextMenuShortcut>)}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Export */}
        <ContextMenuItem onClick={() => handleAction('export')}>
          <Download className="mr-2 h-4 w-4" />
          Export Board...
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Rename and Delete */}
        <ContextMenuItem onClick={() => handleAction('rename')}>
          <Pencil className="mr-2 h-4 w-4" />
          Rename
          {isDesktop() && (<ContextMenuShortcut>F2</ContextMenuShortcut>)}
        </ContextMenuItem>

        <ContextMenuItem onClick={() => handleAction('delete')}>
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">Delete</span>
          {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Del' : '⌘⌫'}</ContextMenuShortcut>)}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
