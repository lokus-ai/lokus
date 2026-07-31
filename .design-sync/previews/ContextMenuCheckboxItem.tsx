import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuCheckboxItem,
  ContextMenuShortcut,
} from 'lokus';
import { RefreshCw, Eye } from 'lucide-react';

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

/* Checkbox items keep their own state, so the axis worth showing is checked vs
   unchecked inside one real menu — the file-explorer view options. */
export const ExplorerViewOptions = () => (
  <Stage
    left={300}
    top={50}
    backdrop={<Backdrop title="Second Brain" lines={['Right-click on empty space in the file tree.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>View options</ContextMenuLabel>
        <ContextMenuCheckboxItem checked>Show hidden files</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem checked>Group folders first</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show file extensions</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show file size</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
          <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const GraphLayerToggles = () => (
  <Stage
    left={300}
    top={60}
    backdrop={<Backdrop title="Graph view" lines={['128 notes · 411 links · 12 orphans']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Layers</ContextMenuLabel>
        <ContextMenuCheckboxItem checked>Wiki links</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem checked>Backlinks</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Tags</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Orphan notes</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem checked>Node labels</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Eye className="mr-2 h-4 w-4" />
          Reset view
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
