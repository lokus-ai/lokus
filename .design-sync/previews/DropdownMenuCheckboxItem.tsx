import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
} from 'lokus';
import { SlidersHorizontal, PanelsTopLeft } from 'lucide-react';

// The open menu is absolutely positioned, so it adds no height to the themed
// root — without a min-height the card's white body shows behind the menu.
const Stage = ({ children }: any) => <div style={{ minHeight: 374 }}>{children}</div>;

export const EditorToggles = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <SlidersHorizontal className="h-4 w-4" />
        Editor options
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 230 }}>
      <DropdownMenuLabel>Editor</DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked>Show line numbers</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked>Wrap lines</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={false}>Show frontmatter</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={false}>Typewriter scrolling</DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked disabled>
        Spellcheck (locked by workspace)
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);

export const PanelToggles = () => (
  <Stage>
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <PanelsTopLeft className="h-4 w-4" />
        Panels
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent style={{ minWidth: 220 }}>
      <DropdownMenuLabel>Show panels</DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked>File tree</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={false}>Outline</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked>Backlinks</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={false}>Graph preview</DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </Stage>
);
