import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
  Button,
} from 'lokus';
import { MoreHorizontal, FolderInput } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const MoveToFolderSub = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Weekly Review.md
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 230 }}>
      <DropdownMenuItem>
        Rename
        <DropdownMenuShortcut>F2</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSub open>
        <DropdownMenuSubTrigger>
          <FolderInput className="mr-2 h-4 w-4 text-app-muted" />
          Move to folder
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent style={{ minWidth: 200 }}>
          <DropdownMenuItem>Journal</DropdownMenuItem>
          <DropdownMenuItem>Engineering</DropdownMenuItem>
          <DropdownMenuItem>Design</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>New folder…</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Reveal in Finder</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
