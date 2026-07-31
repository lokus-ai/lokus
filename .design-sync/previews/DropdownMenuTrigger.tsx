import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from 'lokus';
import { MoreHorizontal, Plus, FileText, LayoutGrid, PenLine } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const ButtonTrigger = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button size="sm">
        <Plus className="h-4 w-4" />
        New
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 220 }}>
      <DropdownMenuItem>
        <FileText className="mr-2 h-4 w-4 text-app-muted" />
        New note
        <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <LayoutGrid className="mr-2 h-4 w-4 text-app-muted" />
        New kanban board
      </DropdownMenuItem>
      <DropdownMenuItem>
        <PenLine className="mr-2 h-4 w-4 text-app-muted" />
        New canvas
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>From template…</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const IconTrigger = () => (
  <Stage>
  <div className="flex items-center gap-3 rounded-md border border-app-border bg-app-panel px-3 py-2">
    <FileText className="h-4 w-4 text-app-muted" />
    <span className="text-sm text-app-text">Sprint 24 Retro.md</span>
    <span className="ml-auto" />
    <DropdownMenu open modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ minWidth: 200 }}>
        <DropdownMenuItem>Open in new tab</DropdownMenuItem>
        <DropdownMenuItem>Pin to sidebar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-400 focus:text-red-400">
          Move to Trash
          <DropdownMenuShortcut>⌘⇧D</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  </Stage>
);
