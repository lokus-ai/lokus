import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from 'lokus';
import { MoreHorizontal, Star, Tag, GitGraph, Trash2 } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const ItemStates = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Roadmap Q3.md
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 250 }}>
      <DropdownMenuItem>
        <Star className="mr-2 h-4 w-4 text-app-muted" />
        Add to favourites
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Tag className="mr-2 h-4 w-4 text-app-muted" />
        Edit tags
        <DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <GitGraph className="mr-2 h-4 w-4 text-app-muted" />
        Show in graph view
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled>Publish (needs sync enabled)</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-red-400 focus:text-red-400">
        <Trash2 className="mr-2 h-4 w-4" />
        Move to Trash
        <DropdownMenuShortcut>⌘⇧D</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const InsetItems = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        Recent notes
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 240 }}>
      <DropdownMenuItem inset>Weekly Review.md</DropdownMenuItem>
      <DropdownMenuItem inset>Sprint 24 Retro.md</DropdownMenuItem>
      <DropdownMenuItem inset>Sync Engine Notes.md</DropdownMenuItem>
      <DropdownMenuItem inset>Design Tokens.md</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem inset>
        Clear recent
        <DropdownMenuShortcut>⌘⇧K</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
