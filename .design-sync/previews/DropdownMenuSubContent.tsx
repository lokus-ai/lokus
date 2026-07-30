import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  Button,
} from 'lokus';
import { MoreHorizontal, FileDown } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const ExportSubContent = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Sprint 24 Retro.md
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 220 }}>
      <DropdownMenuItem>Rename</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub open>
        <DropdownMenuSubTrigger>
          <FileDown className="mr-2 h-4 w-4 text-app-muted" />
          Export as
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent style={{ minWidth: 220 }}>
          <DropdownMenuLabel>Keep formatting</DropdownMenuLabel>
          <DropdownMenuItem>
            Markdown (.md)
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>PDF</DropdownMenuItem>
          <DropdownMenuItem>HTML</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Plain</DropdownMenuLabel>
          <DropdownMenuItem>Text (.txt)</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
