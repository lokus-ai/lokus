import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuShortcut,
} from 'lokus';
import { Scissors, Copy, Files, FolderOpen, Trash2, Download, Archive, Tag, Star } from 'lucide-react';

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

/* A label is a non-interactive heading — muted, one step smaller than the items
   it introduces. Here it names each section of a long menu. */
export const SectionHeadings = () => (
  <Stage
    left={300}
    top={20}
    backdrop={<Backdrop title="Engineering" lines={['Weekly Review.md', 'Sync V2 Notes.md', 'Manifest spec.md']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Clipboard</ContextMenuLabel>
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
          <Files className="mr-2 h-4 w-4" />
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>Organise</ContextMenuLabel>
        <ContextMenuItem>
          <Tag className="mr-2 h-4 w-4" />
          Add Tag…
        </ContextMenuItem>
        <ContextMenuItem>
          <Star className="mr-2 h-4 w-4" />
          Add to Favourites
        </ContextMenuItem>
        <ContextMenuItem>
          <FolderOpen className="mr-2 h-4 w-4" />
          Move to…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const SelectionCountLabel = () => (
  <Stage
    left={300}
    top={54}
    backdrop={<Backdrop title="Journal" lines={['3 notes selected in the file tree.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>3 items selected</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Copy className="mr-2 h-4 w-4" />
          Copy 3 Items
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <FolderOpen className="mr-2 h-4 w-4" />
          Move to…
        </ContextMenuItem>
        <ContextMenuItem>
          <Download className="mr-2 h-4 w-4" />
          Export 3 Items…
        </ContextMenuItem>
        <ContextMenuItem>
          <Archive className="mr-2 h-4 w-4" />
          Create Archive…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">Delete 3 Items</span>
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
