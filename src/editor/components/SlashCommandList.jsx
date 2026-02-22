import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../components/ui/command";

const SlashCommandList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  const allItems = useMemo(
    () => props.items.flatMap((group) => group.commands),
    [props.items],
  );

  // Reset selection when items change (e.g. query filter narrows results)
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems]);

  // Scroll the selected item into view whenever selection changes
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll("[cmdk-item]");
      const selected = items[selectedIndex];
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    });
  }, [selectedIndex]);

  const selectItem = useCallback(
    (index) => {
      const item = allItems[index];
      if (item && typeof props.command === "function") {
        props.command(item);
      }
    },
    [allItems, props.command],
  );

  // Keyboard events arrive here from TipTap's Suggestion plugin (the editor
  // retains focus, not this menu). We manage selection entirely ourselves.
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % allItems.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + allItems.length) % allItems.length,
        );
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  // Build a flat index counter that persists across groups so each item
  // in the flat allItems array maps to the correct CommandItem.
  let itemCounter = 0;

  return (
    <Command
      shouldFilter={false}
      // Force cmdk's internal value to empty string so it never marks any
      // item as data-selected. The empty string is falsy in cmdk's check
      // (v.value && v.value === itemValue) so aria-selected / data-selected
      // stay false on every item. We handle highlighting ourselves.
      value=""
      onValueChange={() => {}}
      // Prevent cmdk from updating its selection when the pointer moves
      // over items. Without this, hovering sets cmdk's internal value which
      // can re-appear if a re-render causes value to briefly unsync.
      disablePointerSelection
      className="w-80 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text"
    >
      <CommandList
        ref={listRef}
        className="max-h-[330px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
      >
        <CommandEmpty>No results found.</CommandEmpty>
        {props.items.map((group, groupIndex) => (
          <React.Fragment key={group.group}>
            <CommandGroup heading={group.group}>
              {group.commands.map((item) => {
                const currentIndex = itemCounter++;
                const isSelected = selectedIndex === currentIndex;
                return (
                  <CommandItem
                    key={item.title}
                    value={item.title}
                    onSelect={() => selectItem(currentIndex)}
                    className={
                      isSelected
                        ? "bg-app-accent !text-app-accent-fg"
                        : ""
                    }
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-app-bg rounded-md mr-3">
                      {item.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-app-muted">
                        {item.description}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {groupIndex < props.items.length - 1 && <CommandSeparator />}
          </React.Fragment>
        ))}
      </CommandList>
    </Command>
  );
});

SlashCommandList.displayName = "SlashCommandList";

export default SlashCommandList;
