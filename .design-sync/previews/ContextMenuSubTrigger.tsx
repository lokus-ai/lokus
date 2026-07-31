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
} from 'lokus';
import { Type, Sparkles, Heading, List, ExternalLink, FileText, Eye, Link, Tag } from 'lucide-react';

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

/* Four sub-triggers stacked: the chevron column is the whole point, so the last
   one is expanded to show the open state alongside the closed ones. */
export const SubTriggerStack = () => (
  <Stage
    left={90}
    top={40}
    backdrop={<Backdrop title="Weekly Review" lines={['Editor right-click, text selected.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Type className="mr-2 h-4 w-4" />
            Format
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem>Bold</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Sparkles className="mr-2 h-4 w-4" />
            Insert
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem>Link</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <List className="mr-2 h-4 w-4" />
            Lists
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem>Bullet list</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub open>
          <ContextMenuSubTrigger>
            <Heading className="mr-2 h-4 w-4" />
            Change to Heading
          </ContextMenuSubTrigger>
          <ContextMenuSubContent forceMount className="w-56">
            <ContextMenuItem>
              Heading 1
              <ContextMenuShortcut>⌘⌥1</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              Heading 2
              <ContextMenuShortcut>⌘⌥2</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              Heading 3
              <ContextMenuShortcut>⌘⌥3</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>
              Normal Text
              <ContextMenuShortcut>⌘⌥0</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const InsetSubTrigger = () => (
  <Stage
    left={100}
    top={70}
    backdrop={<Backdrop title="Engineering" lines={['Sync V2 Notes.md — right-clicked in the file tree.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuItem inset>Open</ContextMenuItem>
        <ContextMenuSub open>
          <ContextMenuSubTrigger inset>Open With…</ContextMenuSubTrigger>
          <ContextMenuSubContent forceMount className="w-56">
            <ContextMenuItem>
              <FileText className="mr-2 h-4 w-4" />
              Default Editor
            </ContextMenuItem>
            <ContextMenuItem>
              <ExternalLink className="mr-2 h-4 w-4" />
              External Application
            </ContextMenuItem>
            <ContextMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              System Default
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Link className="mr-2 h-4 w-4" />
          Copy Path
        </ContextMenuItem>
        <ContextMenuItem>
          <Tag className="mr-2 h-4 w-4" />
          Add Tag…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
