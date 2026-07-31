import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from 'lokus';
import { Plus, Calendar, Network, FileText, Link2, Save, Sparkles } from 'lucide-react';

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

/** Item anatomy: leading icon, label, trailing shortcut — first item carries the accent selection. */
export const ItemStates = () => (
  <Shell>
    <Command loop value="New note">
      <CommandInput placeholder="Type a command or search files..." />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="File">
          <CommandItem value="New note">
            <Plus className="mr-2 h-4 w-4" />
            <span>New note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem value="Open daily note">
            <Calendar className="mr-2 h-4 w-4" />
            <span>Open daily note</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem value="Insert wiki link">
            <Link2 className="mr-2 h-4 w-4" />
            <span>Insert wiki link [[</span>
          </CommandItem>
          <CommandItem value="Save file" disabled>
            <Save className="mr-2 h-4 w-4" />
            <span>Save file</span>
            <CommandShortcut>no unsaved changes</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);

/** The same primitive as a search result: filename, folder breadcrumb, and an accent-selected row. */
export const NoteResultItems = () => (
  <Shell>
    <Command loop shouldFilter={false} value="Sync V2 Manifest.md">
      <CommandInput value="sync" onValueChange={() => {}} placeholder="Type a command or search files..." />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Recent notes">
          <CommandItem value="Sync V2 Manifest.md">
            <FileText className="mr-2 h-4 w-4" />
            <span>Sync V2 Manifest.md</span>
            <CommandShortcut className="text-xs">Engineering/Sync</CommandShortcut>
          </CommandItem>
          <CommandItem value="Offline Queue.md">
            <FileText className="mr-2 h-4 w-4" />
            <span>Offline Queue.md</span>
            <CommandShortcut className="text-xs">Engineering/Sync</CommandShortcut>
          </CommandItem>
          <CommandItem value="Weekly Review.md">
            <FileText className="mr-2 h-4 w-4" />
            <span>Weekly Review.md</span>
            <CommandShortcut className="text-xs">Journal</CommandShortcut>
          </CommandItem>
          <CommandItem value="ask ai">
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Ask AI: “sync”</span>
          </CommandItem>
          <CommandItem value="graph" disabled>
            <Network className="mr-2 h-4 w-4" />
            <span>Open graph view</span>
            <CommandShortcut>indexing…</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);
