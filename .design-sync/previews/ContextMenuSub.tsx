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
import {
  ExternalLink,
  FileText,
  Eye,
  Type,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Sparkles,
  Link,
  Image,
  Table,
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

/* Sub is the open/closed unit — it owns the trigger and the panel it reveals.
   Forced open here so the static capture shows the pair. */
export const OpenWithSub = () => (
  <Stage
    left={110}
    top={70}
    backdrop={<Backdrop title="Sync V2 Notes" lines={['Manifest-based reconciliation, one round trip.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuItem>
          <FileText className="mr-2 h-4 w-4" />
          Open
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub open>
          <ContextMenuSubTrigger>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open With…
          </ContextMenuSubTrigger>
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
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const FormatAndInsertSubs = () => (
  <Stage
    left={90}
    top={40}
    backdrop={<Backdrop title="Weekly Review" lines={['Selection: “reconciles in one pass”']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Sparkles className="mr-2 h-4 w-4" />
            Insert
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem>
              <Link className="mr-2 h-4 w-4" />
              Link
            </ContextMenuItem>
            <ContextMenuItem>
              <Image className="mr-2 h-4 w-4" />
              Image
            </ContextMenuItem>
            <ContextMenuItem>
              <Table className="mr-2 h-4 w-4" />
              Table
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub open>
          <ContextMenuSubTrigger>
            <Type className="mr-2 h-4 w-4" />
            Format
          </ContextMenuSubTrigger>
          <ContextMenuSubContent forceMount className="w-56">
            <ContextMenuItem>
              <Bold className="mr-2 h-4 w-4" />
              Bold
              <ContextMenuShortcut>⌘B</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Italic className="mr-2 h-4 w-4" />
              Italic
              <ContextMenuShortcut>⌘I</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Strikethrough className="mr-2 h-4 w-4" />
              Strikethrough
              <ContextMenuShortcut>⌘⇧X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <Code className="mr-2 h-4 w-4" />
              Inline Code
              <ContextMenuShortcut>⌘E</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Type className="mr-2 h-4 w-4" />
          Clear Formatting
          <ContextMenuShortcut>⌘\</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
