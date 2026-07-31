import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuShortcut,
} from 'lokus';
import {
  FileText,
  FolderOpen,
  Pencil,
  Trash2,
  Copy,
  Scissors,
  Clipboard,
  Link,
  Star,
  Tag,
  Download,
  Search,
  RefreshCw,
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

export const CompactContent = () => (
  <Stage
    left={360}
    top={54}
    backdrop={<Backdrop title="Journal" lines={['2026-07-27.md', '2026-07-26.md', '2026-07-25.md']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-56">
        <ContextMenuItem>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
        </ContextMenuItem>
        <ContextMenuItem>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem>
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const WideContentWithShortcuts = () => (
  <Stage
    left={300}
    top={40}
    backdrop={
      <Backdrop
        title="Weekly Review"
        lines={['Shipped the manifest diff rewrite.', 'Open threads: trash retention, queue drain order.']}
      />
    }
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
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
          <Link className="mr-2 h-4 w-4" />
          Copy Path
          <ContextMenuShortcut>⌘⌥C</ContextMenuShortcut>
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

export const LongGroupedContent = () => (
  <Stage
    left={330}
    top={16}
    backdrop={<Backdrop title="Design" lines={['Canvas ideas.md', 'Icon set.md', 'Type scale.md']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Workspace</ContextMenuLabel>
        <ContextMenuItem>
          <Search className="mr-2 h-4 w-4" />
          Find in Folder…
          <ContextMenuShortcut>⌘⇧F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Now
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>Note</ContextMenuLabel>
        <ContextMenuItem>
          <Star className="mr-2 h-4 w-4" />
          Add to Favourites
        </ContextMenuItem>
        <ContextMenuItem>
          <Tag className="mr-2 h-4 w-4" />
          Add Tag…
        </ContextMenuItem>
        <ContextMenuItem>
          <Download className="mr-2 h-4 w-4" />
          Export as PDF…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">Move to Trash</span>
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
