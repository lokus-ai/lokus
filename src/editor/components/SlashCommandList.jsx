import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
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
  const [value, setValue] = useState("");

  const allItems = useMemo(() =>
    props.items.flatMap(group => group.commands),
    [props.items]
  );

  // Set initial value when items change
  useEffect(() => {
    if (allItems.length > 0) {
      setValue(allItems[0].title);
    }
  }, [allItems]);

  const selectItem = (itemTitle) => {
    const item = allItems.find(i => i.title.toLowerCase() === itemTitle?.toLowerCase());
    if (item) {
      if (typeof props.command === 'function') {
        props.command(item);
      } else {
      }
    } else {
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // We manage selection ourselves because the command menu doesn't own focus
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const idx = allItems.findIndex(i => i.title === value);
        if (idx !== -1) {
          const next = event.key === "ArrowDown"
            ? (idx + 1) % allItems.length
            : (idx - 1 + allItems.length) % allItems.length;
          setValue(allItems[next].title);
        } else if (allItems.length) {
          setValue(allItems[0].title);
        }
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectItem(value);
        return true;
      }
      return false;
    },
  }));

  return (
    <Command
      value={value}
      onValueChange={setValue}
      onKeyDown={(e) => {
        // This prevents the editor from capturing the Enter key press
        if (e.key === "Enter") {
          e.preventDefault();
        }
      }}
      className="w-80 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text"
    >
      <CommandList
        ref={el => {
          // This ensures the selected item is always visible
          if (el) {
            const item = el.querySelector(`[aria-selected="true"]`);
            if (item) {
              item.scrollIntoView({ block: "nearest" });
            }
          }
        }}
        className="max-h-[330px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
      >
        <CommandEmpty>No results found.</CommandEmpty>
        {props.items.map((group, groupIndex) => (
          <React.Fragment key={group.group}>
            <CommandGroup heading={group.group}>
              {group.commands.map((item) => (
                <CommandItem
                  key={item.title}
                  value={item.title}
                  onSelect={selectItem}
                  aria-selected={value === item.title}
                  className={`${value === item.title ? 'bg-app-accent text-app-accent-fg' : ''}`}
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
              ))}
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