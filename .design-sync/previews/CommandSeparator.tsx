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
import { Sparkles, Plus, Calendar, Network, Settings, FileText, Folder } from 'lucide-react';

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

/** Hairline rules on --border split AI from File, View, and workspace results. */
export const SectionRules = () => (
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
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="View">
          <CommandItem>
            <Network className="mr-2 h-4 w-4" />
            <span>Toggle graph view</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Recent notes">
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Weekly Review.md</span>
            <CommandShortcut className="text-xs">Journal</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Folders">
          <CommandItem>
            <Folder className="mr-2 h-4 w-4" />
            <span>Engineering</span>
            <CommandShortcut className="text-xs">88 notes</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);
