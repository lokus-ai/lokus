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
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems = useMemo(() => 
    props.items.flatMap(group => group.commands), 
    [props.items]
  );

  const selectItem = (index) => {
    const item = allItems[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((prev) => (prev + allItems.length - 1) % allItems.length);
  };

  const downHandler = () => {
    setSelectedIndex((prev) => (prev + 1) % allItems.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [allItems]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <Command className="w-80 rounded-lg border border-app-border shadow-md bg-app-panel text-app-text">
      <CommandList className="max-h-[330px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <CommandEmpty>No results found.</CommandEmpty>
        {props.items.map((group, groupIndex) => (
          <React.Fragment key={group.group}>
            <CommandGroup heading={group.group}>
              {group.commands.map((item, commandIndex) => {
                const overallIndex = props.items.slice(0, groupIndex).reduce((acc, g) => acc + g.commands.length, 0) + commandIndex;
                return (
                  <CommandItem
                    key={item.title}
                    onSelect={() => selectItem(overallIndex)}
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