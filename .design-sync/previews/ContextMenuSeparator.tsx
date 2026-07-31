import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from 'lokus';
import {
  FilePlus,
  FolderPlus,
  FileText,
  FolderOpen,
  Scissors,
  Copy,
  Clipboard,
  Pencil,
  Trash2,
  RefreshCw,
  Upload,
} from 'lucide-react';

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

const Backdrop = ({ title, lines }) => (
  <div style={{ padding: '18px 24px' }}>
    <div className="text-app-text" style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
      {title}
    </div>
    {lines.map((l) => (
      <div key={l} className="text-sm text-app-muted" style={{ marginBottom: 8, lineHeight: 1.6 }}>
        {l}
      </div>
    ))}
  </div>
);

const Stage = ({ left, top, backdrop, children }) => (
  <div style={stage}>
    <style>{CTX_CSS}</style>
    {backdrop}
    <div className="ctx-stage" style={{ position: 'absolute', left, top }}>
      {children}
    </div>
  </div>
);

/* Separators are the only thing giving the file menu its four action groups:
   create / open / clipboard / destructive. */
export const FourActionGroups = () => (
  <Stage
    left={310}
    top={16}
    backdrop={<Backdrop title="Engineering" lines={['Weekly Review.md', 'Sync V2 Notes.md']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuItem>
          <FilePlus className="mr-2 h-4 w-4" />
          New File
          <ContextMenuShortcut>⌘N</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
          <ContextMenuShortcut>⌘⇧N</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <FileText className="mr-2 h-4 w-4" />
          Open
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <FolderOpen className="mr-2 h-4 w-4" />
          Reveal in Finder
          <ContextMenuShortcut>⌥R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">Delete</span>
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const SingleSplit = () => (
  <Stage
    left={330}
    top={70}
    backdrop={<Backdrop title="Second Brain" lines={['Synced 4 minutes ago · 128 notes']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-56">
        <ContextMenuItem>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Now
        </ContextMenuItem>
        <ContextMenuItem>
          <Upload className="mr-2 h-4 w-4" />
          Push local changes
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Pencil className="mr-2 h-4 w-4" />
          Rename workspace
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
