import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from 'lokus';
import { Palette } from 'lucide-react';

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

/* Selected vs unselected is the whole story of a radio item: filled bullet on the
   active theme, hollow on the rest. */
export const ThemeChoice = () => (
  <Stage
    left={300}
    top={54}
    backdrop={<Backdrop title="Appearance" lines={['Right-click the theme swatch in the status bar.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Theme</ContextMenuLabel>
        <ContextMenuRadioGroup value="lokus-dark">
          <ContextMenuRadioItem value="lokus-dark" checked>
            Lokus Dark
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="lokus-light">Lokus Light</ContextMenuRadioItem>
          <ContextMenuRadioItem value="rose-pine">Rosé Pine</ContextMenuRadioItem>
          <ContextMenuRadioItem value="system">Match system</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Palette className="mr-2 h-4 w-4" />
          Open theme settings…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);

export const TaskStatusChoice = () => (
  <Stage
    left={300}
    top={44}
    backdrop={<Backdrop title="Kanban · Sync V2" lines={['Right-click the card “Offline queue drain order”.']} />}
  >
    <ContextMenu>
      <ContextMenuTrigger />
      <ContextMenuContent forceMount className="w-72">
        <ContextMenuLabel>Status</ContextMenuLabel>
        <ContextMenuRadioGroup value="in-progress">
          <ContextMenuRadioItem value="todo">To do</ContextMenuRadioItem>
          <ContextMenuRadioItem value="in-progress" checked>
            In progress
          </ContextMenuRadioItem>
          <ContextMenuRadioItem value="blocked">Blocked</ContextMenuRadioItem>
          <ContextMenuRadioItem value="done">Done</ContextMenuRadioItem>
          <ContextMenuRadioItem value="cancelled">Cancelled</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  </Stage>
);
