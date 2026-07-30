import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from 'lokus';
import {
  Sparkles,
  Plus,
  FolderPlus,
  Calendar,
  Save,
  Network,
  Settings,
  ToggleLeft,
  FileText,
  Link2,
  Search,
} from 'lucide-react';

const Shell = ({ children }) => (
  <div style={{ minHeight: "calc(100vh - 48px)", display: "flex", alignItems: "center" }}>
    <div
      className="mx-auto w-full overflow-hidden rounded-lg border border-app-border bg-app-panel shadow-2xl"
      style={{ maxWidth: 640 }}
    >
      {children}
    </div>
  </div>
);

/** The Lokus ⌘K palette as it opens: AI first, then File and View commands. */
export const CommandPalette = () => (
  <Shell>
    <Command loop>
      <CommandInput placeholder="Type a command or search files..." />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="AI">
          <CommandItem value="ask ai">
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Ask AI…</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="File">
          <CommandItem>
            <Plus className="mr-2 h-4 w-4" />
            <span>New note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>New folder</span>
            <CommandShortcut>⌘⇧N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Open daily note</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Link2 className="mr-2 h-4 w-4" />
            <span>Insert wiki link [[</span>
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="View">
          <CommandItem>
            <ToggleLeft className="mr-2 h-4 w-4" />
            <span>Toggle sidebar</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Network className="mr-2 h-4 w-4" />
            <span>Toggle graph view</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Search className="mr-2 h-4 w-4" />
            <span>Search all notes</span>
            <CommandShortcut>⌘⇧F</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);

/** Mid-query: the palette narrows to graph commands plus matching notes. */
export const FilteredByQuery = () => (
  <Shell>
    <Command loop shouldFilter={false} value="Toggle graph view">
      <CommandInput value="graph" onValueChange={() => {}} placeholder="Type a command or search files..." />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          <CommandItem value="Toggle graph view">
            <Network className="mr-2 h-4 w-4" />
            <span>Toggle graph view</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem value="Open graph in new window">
            <Network className="mr-2 h-4 w-4" />
            <span>Open graph in new window</span>
            <CommandShortcut>⌘⇧G</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Recent notes">
          <CommandItem value="Graph View Rework.md">
            <FileText className="mr-2 h-4 w-4" />
            <span>Graph View Rework.md</span>
            <CommandShortcut className="text-xs">Engineering</CommandShortcut>
          </CommandItem>
          <CommandItem value="Force graph tuning.md">
            <FileText className="mr-2 h-4 w-4" />
            <span>Force graph tuning.md</span>
            <CommandShortcut className="text-xs">Engineering/3D</CommandShortcut>
          </CommandItem>
          <CommandItem value="Weekly Review.md">
            <FileText className="mr-2 h-4 w-4" />
            <span>Weekly Review.md</span>
            <CommandShortcut className="text-xs">Journal</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);
