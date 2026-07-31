import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from 'lokus';
import { FileText, Pencil, Trash2, Copy, FolderOpen, Tag, Clock, ArrowRight } from 'lucide-react';

const CTX_CSS =
  '.ctx-stage > [data-radix-popper-content-wrapper]{position:absolute!important;transform:none!important;}';

const stage = {
  position: 'relative',
  height: 420,
  overflow: 'hidden',
  borderRadius: 'var(--radius)',
  border: '1px solid rgb(var(--border))',
  background: 'rgb(var(--bg))',
};

/* The trigger is the surface you right-click. Here it wraps a real file-tree row
   and a real kanban card, with the menu pinned next to it (a static capture has
   no pointer event to position from). */

export const FileRowTrigger = () => (
  <div style={stage}>
    <style>{CTX_CSS}</style>
    <div
      className="bg-app-panel"
      style={{ width: 248, height: '100%', borderRight: '1px solid rgb(var(--border))', padding: '10px 6px' }}
    >
      <div className="text-xs font-medium text-app-muted" style={{ padding: '0 8px 8px' }}>
        ENGINEERING
      </div>
      <div className="flex items-center gap-2 rounded-sm text-sm text-app-text" style={{ padding: '4px 8px' }}>
        <FileText className="h-4 w-4 text-app-muted" />
        <span>Sync V2 Notes.md</span>
      </div>
    </div>
    <div className="ctx-stage" style={{ position: 'absolute', left: 6, top: 78 }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex items-center gap-2 rounded-sm text-sm text-app-text"
            style={{
              width: 236,
              padding: '4px 8px',
              background: 'rgb(var(--accent) / 0.18)',
              boxShadow: 'inset 0 0 0 1px rgb(var(--accent))',
            }}
          >
            <FileText className="h-4 w-4 text-app-accent" />
            <span>Weekly Review.md</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent forceMount className="w-72" style={{ marginLeft: 128, marginTop: 20 }}>
          <ContextMenuItem>
            <FileText className="mr-2 h-4 w-4" />
            Open
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <ArrowRight className="mr-2 h-4 w-4" />
            Open to the Side
            <ContextMenuShortcut>⌘Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Clock className="mr-2 h-4 w-4" />
            View History
            <ContextMenuShortcut>⌘H</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <FolderOpen className="mr-2 h-4 w-4" />
            Reveal in Finder
            <ContextMenuShortcut>⌥R</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
            <span className="text-red-500">Delete</span>
            <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  </div>
);

export const KanbanCardTrigger = () => (
  <div style={stage}>
    <style>{CTX_CSS}</style>
    <div style={{ display: 'flex', gap: 12, padding: 16, height: '100%' }}>
      <div
        className="bg-app-panel"
        style={{ width: 210, borderRadius: 'var(--radius)', padding: 10, border: '1px solid rgb(var(--border))' }}
      >
        <div className="text-xs font-medium text-app-muted" style={{ marginBottom: 8 }}>
          IN PROGRESS · 2
        </div>
        <div style={{ height: 44 }} />
        <div
          className="text-sm text-app-text"
          style={{
            background: 'rgb(var(--panel-secondary))',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
          }}
        >
          Manifest diff edge cases
        </div>
      </div>
      <div
        className="bg-app-panel"
        style={{ width: 210, borderRadius: 'var(--radius)', padding: 10, border: '1px solid rgb(var(--border))' }}
      >
        <div className="text-xs font-medium text-app-muted" style={{ marginBottom: 8 }}>
          DONE · 1
        </div>
        <div
          className="text-sm text-app-text"
          style={{
            background: 'rgb(var(--panel-secondary))',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
          }}
        >
          Trash retention job
        </div>
      </div>
    </div>
    <div className="ctx-stage" style={{ position: 'absolute', left: 26, top: 62 }}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="text-sm text-app-text"
            style={{
              width: 190,
              padding: '8px 10px',
              borderRadius: 'var(--radius)',
              background: 'rgb(var(--panel-secondary))',
              boxShadow: 'inset 0 0 0 1px rgb(var(--accent))',
            }}
          >
            Offline queue drain order
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent forceMount className="w-56" style={{ marginLeft: 96, marginTop: 26 }}>
          <ContextMenuItem>
            <Pencil className="mr-2 h-4 w-4" />
            Edit card
          </ContextMenuItem>
          <ContextMenuItem>
            <Tag className="mr-2 h-4 w-4" />
            Add label…
          </ContextMenuItem>
          <ContextMenuItem>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
            <span className="text-red-500">Delete card</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  </div>
);
