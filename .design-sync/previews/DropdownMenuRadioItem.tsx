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
import { ArrowUpDown } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const SelectedAndDisabled = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <ArrowUpDown className="h-4 w-4" />
        Sort: Modified
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 240 }}>
      <DropdownMenuLabel>Sort notes by</DropdownMenuLabel>
      <DropdownMenuRadioGroup value="modified">
        <DropdownMenuRadioItem value="modified" checked>
          Modified
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="created">Created</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioItem value="backlinks" disabled>
          Backlink count (indexing…)
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
