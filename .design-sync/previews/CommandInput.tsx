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

/** Resting state — search icon, muted placeholder, hairline divider under the field. */
export const Placeholder = () => (
  <Shell>
    <Command loop>
      <CommandInput placeholder="Type a command or search files..." />
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
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);

/** Typed query — the field drives cmdk's real filter, so only matching notes survive. */
export const TypedQuery = () => (
  <Shell>
    <Command loop>
      <CommandInput value="review" onValueChange={() => {}} placeholder="Type a command or search files..." />
      <CommandList style={{ maxHeight: 375 }}>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Recent notes">
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Weekly Review.md</span>
            <CommandShortcut className="text-xs">Journal</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Design Review — Canvas.md</span>
            <CommandShortcut className="text-xs">Design</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileText className="mr-2 h-4 w-4" />
            <span>Q3 Review Notes.md</span>
            <CommandShortcut className="text-xs">Journal/2026</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Plus className="mr-2 h-4 w-4" />
            <span>New note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Shell>
);
