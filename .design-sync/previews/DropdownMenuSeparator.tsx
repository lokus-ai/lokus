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
import { MoreHorizontal } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const GroupedSections = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Sync Engine Notes.md
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 250 }}>
      <DropdownMenuLabel>Open</DropdownMenuLabel>
      <DropdownMenuItem>Open in new tab</DropdownMenuItem>
      <DropdownMenuItem>Open to the right</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Edit</DropdownMenuLabel>
      <DropdownMenuItem>
        Rename
        <DropdownMenuShortcut>F2</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        Duplicate
        <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
      <DropdownMenuItem className="text-red-400 focus:text-red-400">
        Move to Trash
        <DropdownMenuShortcut>⌘⇧D</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
