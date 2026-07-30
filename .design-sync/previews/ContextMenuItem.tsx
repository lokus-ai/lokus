import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from 'lokus';
import {
  FileText,
  FolderOpen,
  Pencil,
  Trash2,
  Copy,
  Scissors,
  Files,
  Link,
  Archive,
  Star,
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

export const IconAndShortcutItems = () => (
  <Stage
    left={320}
    top={44}
    backdrop={<Backdrop title="Weekly Review" lines={['Manifest diff rewrite shipped.', 'Trash retention still open.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
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
        <ContextMenuItem>
          <Link className="mr-2 h-4 w-4" />
          Copy Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const InsetItems = () => (
  <Stage
    left={320}
    top={44}
    backdrop={<Backdrop title="Journal" lines={['2026-07-27.md', '2026-07-26.md']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuItem inset>Open in new tab</ContextMenuItem>
        <ContextMenuItem inset>Open to the Side</ContextMenuItem>
        <ContextMenuItem inset>
          Pin to sidebar
          <ContextMenuShortcut>⌘P</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Star className="mr-2 h-4 w-4" />
          Add to Favourites
        </ContextMenuItem>
        <ContextMenuItem>
          <Archive className="mr-2 h-4 w-4" />
          Create Archive…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const DestructiveItem = () => (
  <Stage
    left={320}
    top={44}
    backdrop={<Backdrop title="Design" lines={['Canvas ideas.md', 'Type scale.md', 'Icon set.md']} />}
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
          <Pencil className="mr-2 h-4 w-4" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
          <span className="text-red-500">Move 3 notes to Trash</span>
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
