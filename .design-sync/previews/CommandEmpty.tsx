import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from 'lokus';
import { Plus, Calendar, Network, FileText } from 'lucide-react';

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

/** Query matches nothing in the workspace — every item filters out and Empty takes over. */
export const NoResults = () => (
  <Shell>
    <Command loop>
      <CommandInput
        value="kanban swimlanes"
        onValueChange={() => {}}
        placeholder="Type a command or search files..."
      />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          <CommandItem>
            <Plus className="mr-2 h-4 w-4" />
            <span>New note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Open daily note</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Network className="mr-2 h-4 w-4" />
            <span>Toggle graph view</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Weekly Review.md</span>
            <CommandShortcut className="text-xs">Journal</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);

/** Richer empty copy: the palette offers to create the note the query names. */
export const EmptyWithHint = () => (
  <Shell>
    <Command loop>
      <CommandInput
        value="Retro 2026-07"
        onValueChange={() => {}}
        placeholder="Type a command or search files..."
      />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>
          <div className="px-6">
            <p className="text-app-text">No notes match “Retro 2026-07”.</p>
            <p className="mt-1 text-xs text-app-muted">
              Press ⌘⏎ to create it in Journal/, or ⌘⇧F to search file contents.
            </p>
          </div>
        </CommandEmpty>
        <CommandGroup heading="Recent notes">
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Weekly Review.md</span>
            <CommandShortcut className="text-xs">Journal</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Sync V2 Manifest.md</span>
            <CommandShortcut className="text-xs">Engineering</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);
