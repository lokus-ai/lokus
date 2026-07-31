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
import { Terminal as CommandIcon } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const KeyboardHints = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <CommandIcon className="h-4 w-4" />
        Quick actions
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 300 }}>
      <DropdownMenuLabel>Workspace</DropdownMenuLabel>
      <DropdownMenuItem>
        New note
        <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        Command palette
        <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        Search in workspace
        <DropdownMenuShortcut>⌘⇧F</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Current note</DropdownMenuLabel>
      <DropdownMenuItem>
        Toggle preview
        <DropdownMenuShortcut>⌘⇧P</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem className="text-red-400 focus:text-red-400">
        Move to Trash
        <DropdownMenuShortcut>⌘⇧D</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
