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
} from "@/components/ui/command";

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
    const item = allItems.find(i => i.title === itemTitle);
    if (item) {
      props.command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // Let the Command component handle navigation, but stop the event from propagating to the editor
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        return true;
      }
      
      if (event.key === "Enter") {
        // The onSelect handler on CommandItem will be triggered by the component itself
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
                  className={`data-[selected=true]:bg-app-accent data-[selected=true]:text-app-accent-fg`}
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
