import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from 'lokus';
import { Cloud, MoreHorizontal } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const SectionLabels = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <Cloud className="h-4 w-4" />
        Second Brain
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 250 }}>
      <DropdownMenuLabel>Synced 2 minutes ago</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Workspace</DropdownMenuLabel>
      <DropdownMenuItem>
        Sync now
        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>Sync settings</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Account</DropdownMenuLabel>
      <DropdownMenuItem>Manage devices</DropdownMenuItem>
      <DropdownMenuItem>Stop syncing this workspace</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const InsetLabel = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        Plugins
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 240 }}>
      <DropdownMenuLabel inset>Enabled plugins</DropdownMenuLabel>
      <DropdownMenuItem inset>Kanban Board</DropdownMenuItem>
      <DropdownMenuItem inset>Daily Notes</DropdownMenuItem>
      <DropdownMenuItem inset>Mermaid Diagrams</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem inset>Browse plugin registry…</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
