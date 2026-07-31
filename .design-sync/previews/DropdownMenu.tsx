import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  Button,
} from 'lokus';
import {
  MoreHorizontal,
  Pencil,
  Copy,
  FolderOpen,
  Link2,
  Trash2,
  Eye,
  Check,
  ChevronDown,
} from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const NoteActions = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        Weekly Review.md
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 240 }}>
      <DropdownMenuLabel>Journal / Weekly Review.md</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Pencil className="mr-2 h-4 w-4 text-app-muted" />
        Rename
        <DropdownMenuShortcut>F2</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Copy className="mr-2 h-4 w-4 text-app-muted" />
        Duplicate
        <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Link2 className="mr-2 h-4 w-4 text-app-muted" />
        Copy wikilink
        <DropdownMenuShortcut>⌘⇧C</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <FolderOpen className="mr-2 h-4 w-4 text-app-muted" />
        Reveal in Finder
      </DropdownMenuItem>
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

export const ViewOptions = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <Eye className="h-4 w-4" />
        View
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 220 }}>
      <DropdownMenuLabel>Editor</DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked>Show line numbers</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked>Wrap lines</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={false}>Show frontmatter</DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Sort files by</DropdownMenuLabel>
      <DropdownMenuRadioGroup value="modified">
        <DropdownMenuRadioItem value="modified" checked>
          Modified
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="created">Created</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const WorkspaceSwitcher = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="secondary" size="sm">
        Second Brain
        <ChevronDown className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 250 }}>
      <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
      <DropdownMenuItem>
        <Check className="mr-2 h-4 w-4 text-app-accent" />
        Second Brain
        <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem inset>
        Engineering Notes
        <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem inset>
        Design Journal
        <DropdownMenuShortcut>⌘3</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem inset>Open workspace…</DropdownMenuItem>
      <DropdownMenuItem inset disabled>
        Sync settings (offline)
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
