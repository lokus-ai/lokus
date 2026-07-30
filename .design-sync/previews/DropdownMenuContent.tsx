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
import { MoreHorizontal, Share2 } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const AlignStart = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Engineering
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" style={{ minWidth: 230 }}>
      <DropdownMenuLabel>Folder actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        New note here
        <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>New subfolder</DropdownMenuItem>
      <DropdownMenuItem>
        Search in folder
        <DropdownMenuShortcut>⌘⇧F</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Collapse all</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const AlignEnd = () => (
  <Stage>
  <div className="flex justify-end">
    <DropdownMenu open modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2 className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ minWidth: 240 }}>
        <DropdownMenuLabel>Export “Weekly Review.md”</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Markdown (.md)</DropdownMenuItem>
        <DropdownMenuItem>PDF</DropdownMenuItem>
        <DropdownMenuItem>HTML</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Copy as plain text</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  </Stage>
);
