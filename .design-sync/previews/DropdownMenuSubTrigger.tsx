import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  Button,
} from 'lokus';
import { MoreHorizontal, FolderInput, Tag, FileDown } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const NestedTriggers = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Design Tokens.md
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 230 }}>
      <DropdownMenuItem>Open in new tab</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FolderInput className="mr-2 h-4 w-4 text-app-muted" />
          Move to folder
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem>Journal</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub open>
        <DropdownMenuSubTrigger>
          <Tag className="mr-2 h-4 w-4 text-app-muted" />
          Add tag
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent style={{ minWidth: 190 }}>
          <DropdownMenuItem>#design-system</DropdownMenuItem>
          <DropdownMenuItem>#tokens</DropdownMenuItem>
          <DropdownMenuItem>#needs-review</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FileDown className="mr-2 h-4 w-4 text-app-muted" />
          Export as
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem>PDF</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
