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
import { Sparkles, Plus, Calendar, Network, FileText, Folder, Puzzle } from 'lucide-react';

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

/** Four headed groups — AI, File, Recent notes, Folders — each with its own muted caption. */
export const HeadedGroups = () => (
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
            <Calendar className="mr-2 h-4 w-4" />
            <span>Open daily note</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
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
        <CommandSeparator />
        <CommandGroup heading="Folders">
          <CommandItem>
            <Folder className="mr-2 h-4 w-4" />
            <span>Journal</span>
            <CommandShortcut className="text-xs">142 notes</CommandShortcut>
          </CommandItem>
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

/** Groups can also stay unheaded — plugin commands merge straight into the flow. */
export const UnheadedGroup = () => (
  <Shell>
    <Command loop>
      <CommandInput placeholder="Type a command or search files..." />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem>
            <Network className="mr-2 h-4 w-4" />
            <span>Toggle graph view</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Plus className="mr-2 h-4 w-4" />
            <span>New note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Plugin commands">
          <CommandItem>
            <Puzzle className="mr-2 h-4 w-4" />
            <span>Excalidraw: New drawing</span>
            <CommandShortcut className="text-xs">Canvas</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Puzzle className="mr-2 h-4 w-4" />
            <span>Zotero: Import citation</span>
            <CommandShortcut className="text-xs">Research</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);
