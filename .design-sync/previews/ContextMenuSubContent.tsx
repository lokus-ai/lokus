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
import { Heading, Type, Sparkles, Link, Image, Grid3x3 as TableIcon, FileCode, Quote } from 'lucide-react';

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

/* SubContent is the panel that flies out to the right of its trigger — it carries
   the same panel/border/shadow tokens as the root content, one level narrower. */
export const HeadingLevels = () => (
  <Stage
    left={80}
    top={90}
    backdrop={<Backdrop title="Weekly Review" lines={['Caret on a paragraph line.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuItem>
          <Type className="mr-2 h-4 w-4" />
          Clear Formatting
          <ContextMenuShortcut>⌘\</ContextMenuShortcut>
        </ContextMenuItem>
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
            <ContextMenuItem>Heading 4</ContextMenuItem>
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

export const InsertPanel = () => (
  <Stage
    left={80}
    top={70}
    backdrop={<Backdrop title="Sync V2 Notes" lines={['Inserting a block at the caret.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuSub open>
          <ContextMenuSubTrigger>
            <Sparkles className="mr-2 h-4 w-4" />
            Insert
          </ContextMenuSubTrigger>
          <ContextMenuSubContent forceMount className="w-56">
            <ContextMenuItem>
              <Link className="mr-2 h-4 w-4" />
              Link
              <ContextMenuShortcut>⌘K</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Image className="mr-2 h-4 w-4" />
              Image
            </ContextMenuItem>
            <ContextMenuItem>
              <TableIcon className="mr-2 h-4 w-4" />
              Table
            </ContextMenuItem>
            <ContextMenuItem>
              <FileCode className="mr-2 h-4 w-4" />
              Code Block
              <ContextMenuShortcut>⌘⇧C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Quote className="mr-2 h-4 w-4" />
              Blockquote
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Link className="mr-2 h-4 w-4" />
          Copy block reference
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
