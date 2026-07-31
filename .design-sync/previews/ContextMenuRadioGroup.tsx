import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
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

/* The group is what makes the choice exclusive — one bullet across the set. */
export const SortFileTree = () => (
  <Stage
    left={300}
    top={54}
    backdrop={<Backdrop title="Second Brain" lines={['Right-click on the file tree header.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Sort by</ContextMenuLabel>
        <ContextMenuRadioGroup value="modified">
          <ContextMenuRadioItem value="name">Name (A–Z)</ContextMenuRadioItem>
          <ContextMenuRadioItem value="modified" checked>
            Last modified
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="created">Date created</ContextMenuRadioItem>
          <ContextMenuRadioItem value="size">File size</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
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

export const TwoGroupsInOneMenu = () => (
  <Stage
    left={300}
    top={24}
    backdrop={<Backdrop title="Weekly Review" lines={['Right-click on the editor tab.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Editor mode</ContextMenuLabel>
        <ContextMenuRadioGroup value="live">
          <ContextMenuRadioItem value="source">Source</ContextMenuRadioItem>
          <ContextMenuRadioItem value="live" checked>
            Live preview
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="reading">Reading</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuLabel>Split</ContextMenuLabel>
        <ContextMenuRadioGroup value="none">
          <ContextMenuRadioItem value="none" checked>
            No split
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="vertical">Split right</ContextMenuRadioItem>
          <ContextMenuRadioItem value="horizontal">Split down</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Eye className="mr-2 h-4 w-4" />
          Toggle focus mode
          <ContextMenuShortcut>⌘⇧F</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
