import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
} from 'lokus';
import { ArrowUpDown, Palette } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const SortFilesBy = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <ArrowUpDown className="h-4 w-4" />
        Sort
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 220 }}>
      <DropdownMenuLabel>Sort files by</DropdownMenuLabel>
      <DropdownMenuRadioGroup value="modified">
        <DropdownMenuRadioItem value="modified" checked>
          Modified
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="created">Created</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Direction</DropdownMenuLabel>
      <DropdownMenuRadioGroup value="desc">
        <DropdownMenuRadioItem value="desc" checked>
          Newest first
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="asc">Oldest first</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const ThemeGroup = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <Palette className="h-4 w-4" />
        Theme
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 210 }}>
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup value="dark">
        <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" checked>
          Dark
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
