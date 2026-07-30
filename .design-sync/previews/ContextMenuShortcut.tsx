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
  Search,
  Bold,
  Italic,
  Code,
  Link,
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

/* Shortcut pushes itself to the right edge with ml-auto, so a menu with mixed
   short and long hints still keeps one clean right-aligned column. */
export const MacShortcutColumn = () => (
  <Stage
    left={300}
    top={20}
    backdrop={<Backdrop title="Engineering" lines={['File tree right-click on macOS.']} />}
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
        <ContextMenuItem>
          <Search className="mr-2 h-4 w-4" />
          Find in Folder…
          <ContextMenuShortcut>⌘⇧F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
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
  </Stage>
);

export const WindowsShortcutColumn = () => (
  <Stage
    left={300}
    top={30}
    backdrop={<Backdrop title="Weekly Review" lines={['Editor right-click on Windows.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuItem>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Bold className="mr-2 h-4 w-4" />
          Bold
          <ContextMenuShortcut>Ctrl+B</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Italic className="mr-2 h-4 w-4" />
          Italic
          <ContextMenuShortcut>Ctrl+I</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Code className="mr-2 h-4 w-4" />
          Code Block
          <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <Link className="mr-2 h-4 w-4" />
          Insert Link
          <ContextMenuShortcut>Ctrl+K</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
