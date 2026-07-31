import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from 'lokus';
import { Sparkles, Plus, Calendar, Network, Search, FileText, Link2 } from 'lucide-react';

/** ⌘K over the editor: the palette as a modal, overlay and all. */
export const QuickOpen = () => (
  <CommandDialog open>
    <CommandInput placeholder="Type a command or search files..." />
    <CommandList style={{ maxHeight: 340 }}>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="AI">
        <CommandItem value="ask ai">
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Ask AI…</span>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
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
      <CommandSeparator />
      <CommandGroup heading="Recent notes">
        <CommandItem>
          <FileText className="mr-2 h-4 w-4" />
          <span>Weekly Review.md</span>
          <CommandShortcut className="text-xs">Journal</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
);
