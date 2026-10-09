import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { Portal } from '@radix-ui/react-dropdown-menu';
import { useExplorerSortStore } from '../../stores/explorerSort';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '../../components/ui/dropdown-menu';
import { SORT_OPTIONS } from './sorting';

export function ExplorerSortMenu() {
  const preferences = useExplorerSortStore((s) => s.sortPreferences);
  const setSortPreferences = useExplorerSortStore((s) => s.setSortPreferences);
  const value = `${preferences.sortBy}:${preferences.direction}`;
  const label = SORT_OPTIONS.find((option) => option.value === value).label;
  const SortIcon = preferences.direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="obsidian-button icon-only small"
          title={`Sort files: ${label}`}
          aria-label={`Sort files: ${label}`}
        >
          <SortIcon className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <Portal>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => {
              const [sortBy, direction] = next.split(':');
              setSortPreferences({ sortBy, direction });
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                checked={value === option.value}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            aria-label="Folders first"
            checked={preferences.foldersFirst}
            onCheckedChange={(foldersFirst) => setSortPreferences({ foldersFirst })}
          >
            Folders first
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </Portal>
    </DropdownMenu>
  );
}
