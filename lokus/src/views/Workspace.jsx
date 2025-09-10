import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { DraggableTab } from "./DraggableTab";
import { Menu, FilePlus2, FolderPlus, Search } from "lucide-react";
import Editor from "../editor";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "../components/ui/context-menu.jsx";
import { getActiveShortcuts, formatAccelerator } from "../core/shortcuts/registry.js";

const MAX_OPEN_TABS = 10;

// --- Reusable Icon Component ---
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// --- Draggable Column Hook ---
function useDragColumns({ minLeft = 220, maxLeft = 500, minRight = 220, maxRight = 500 }) {
  const [leftW, setLeftW] = useState(280);
  const [rightW, setRightW] = useState(280);
  const dragRef = useRef(null);

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      if (d.side === "left") {
        setLeftW(Math.min(maxLeft, Math.max(minLeft, d.left0 + (e.clientX - d.startX))));
      } else {
        setRightW(Math.min(maxRight, Math.max(minRight, d.right0 - (e.clientX - d.startX))));
      }
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    if (dragRef.current) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [leftW, rightW, minLeft, maxLeft, minRight, maxRight]);

  const startLeftDrag = (e) => { dragRef.current = { side: "left", startX: e.clientX, left0: leftW, right0: rightW }; };
  const startRightDrag = (e) => { dragRef.current = { side: "right", startX: e.clientX, left0: leftW, right0: rightW }; };

  return { leftW, rightW, startLeftDrag, startRightDrag };
}

// --- New Folder Input ---
function NewFolderInput({ onConfirm, level }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onConfirm(name);
    else if (e.key === "Escape") onConfirm(null);
  };

  return (
    <li style={{ paddingLeft: `${level * 1.25}rem` }} className="flex items-center gap-2 px-2 py-1">
      <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-4 h-4" />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onConfirm(name)}
        className="bg-app-bg text-sm text-app-text outline-none w-full"
        placeholder="New folder..."
      />
    </li>
  );
}

// --- File Entry Component ---
function FileEntryComponent({ entry, level, onFileClick, activeFile, expandedFolders, toggleFolder, onRefresh, keymap }) {
  const { attributes, listeners, setNodeRef: draggableRef, isDragging } = useDraggable({
    id: entry.path,
    data: { type: "file-entry", entry },
  });

  const { setNodeRef: droppableRef, isOver } = useDroppable({
    id: entry.path,
    data: { type: "folder-drop-target", entry },
    disabled: !entry.is_directory,
  });

  const isExpanded = expandedFolders.has(entry.path);
  const isDropTarget = isOver && entry.is_directory;

  const handleClick = () => {
    if (entry.is_directory) {
      toggleFolder(entry.path);
    } else {
      onFileClick(entry);
    }
  };

  const baseClasses = "w-full text-left px-2 py-1 text-sm rounded flex items-center gap-2 transition-colors";
  const stateClasses = activeFile === entry.path ? 'bg-app-accent/20 text-app-text' : 'text-app-muted hover:text-app-text hover:bg-app-bg';
  const dropTargetClasses = isDropTarget ? 'bg-app-accent/30 ring-2 ring-app-accent' : '';
  const draggingClasses = isDragging ? 'opacity-50' : '';

  const onRename = async () => {
    const newName = window.prompt("Rename to:", entry.name);
    if (!newName || newName.trim() === entry.name) return;
    try {
      await invoke("rename_file", { path: entry.path, newName: newName.trim() });
      onRefresh && onRefresh();
    } catch (e) {
      console.error("Failed to rename:", e);
    }
  };

  const onCreateFileHere = async () => {
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      const name = "Untitled.md";
      await invoke("write_file_content", { path: `${base}/${name}`, content: "" });
      onRefresh && onRefresh();
    } catch (e) { console.error(e); }
  };

  const onCreateFolderHere = async () => {
    const name = window.prompt("New folder name:");
    if (!name) return;
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      await invoke("create_folder_in_workspace", { workspacePath: base, name });
      onRefresh && onRefresh();
    } catch (e) { console.error(e); }
  };

  return (
    <li style={{ paddingLeft: `${level * 1.25}rem` }}>
      <div ref={droppableRef} className="rounded">
        <div ref={draggableRef} className="flex items-center">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button {...listeners} {...attributes} onClick={handleClick} className={`${baseClasses} ${stateClasses} ${dropTargetClasses} ${draggingClasses}`}>
                {entry.is_directory ? (
                  <Icon path={isExpanded ? "M19.5 8.25l-7.5 7.5-7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="truncate">{entry.name}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel>{entry.is_directory ? "Folder" : "File"}</ContextMenuLabel>
              <ContextMenuItem onClick={() => onFileClick(entry)}>Open</ContextMenuItem>
              <ContextMenuItem onClick={onRename}>Rename</ContextMenuItem>
              <ContextMenuSeparator />
              {entry.is_directory ? (
                <>
                  <ContextMenuItem onClick={onCreateFileHere}>
                    New File
                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={onCreateFolderHere}>
                    New Folder
                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>
                  </ContextMenuItem>
                </>
              ) : (
                <>
                  <ContextMenuItem onClick={onCreateFileHere}>
                    New File Here
                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={onCreateFolderHere}>
                    New Folder Here
                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>
      {isExpanded && (
        <ul className="space-y-1 mt-1">
          {entry.children?.map(child => (
            <FileEntryComponent
              key={child.path}
              entry={child}
              level={level + 1}
              onFileClick={onFileClick}
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onRefresh={onRefresh}
              keymap={keymap}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- File Tree View Component ---
function FileTreeView({ entries, onFileClick, activeFile, onRefresh, expandedFolders, toggleFolder, isCreating, onCreateConfirm, keymap }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleDragEnd = async (event) => {
    const { over, active } = event;
    if (!over || !active) return;

    const sourceEntry = active.data.current?.entry;
    const targetEntry = over.data.current?.entry;

    if (!sourceEntry || !targetEntry || !targetEntry.is_directory || sourceEntry.path === targetEntry.path) {
      return;
    }

    try {
      await invoke("move_file", {
        sourcePath: sourceEntry.path,
        destinationDir: targetEntry.path,
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to move file:", error);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <ul className="space-y-1">
        {isCreating && <NewFolderInput onConfirm={onCreateConfirm} level={0} />}
        {entries.map(entry => (
          <FileEntryComponent
            key={entry.path}
            entry={entry}
            level={0}
            onFileClick={onFileClick}
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onRefresh={onRefresh}
            keymap={keymap}
          />
        ))}
      </ul>
    </DndContext>
  );
}

// --- Tab Bar Component ---
function TabBar({ tabs, activeTab, onTabClick, onTabClose, unsavedChanges, onDragEnd, onNewTab }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="h-12 shrink-0 flex items-center border-b border-app-border px-2">
        <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <DraggableTab
              key={tab.path}
              tab={tab}
              isActive={activeTab === tab.path}
              isUnsaved={unsavedChanges.has(tab.path)}
              onTabClick={onTabClick}
              onTabClose={onTabClose}
            />
          ))}
        </div>
        <button
          onClick={onNewTab}
          title="New file"
          className="ml-2 h-8 w-8 grid place-items-center rounded-md text-app-muted hover:text-app-text hover:bg-app-bg border border-transparent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </DndContext>
  );
}

// --- Main Workspace Component ---
export default function Workspace({ initialPath = "" }) {
  const [path, setPath] = useState(initialPath);
  const { leftW, startLeftDrag } = useDragColumns({});
  const [showLeft, setShowLeft] = useState(true);
  const [refreshId, setRefreshId] = useState(0);

  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [keymap, setKeymap] = useState({});
  
  const [openTabs, setOpenTabs] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [savedContent, setSavedContent] = useState("");
  
  // --- Refs for stable callbacks ---
  const stateRef = useRef({});
  stateRef.current = {
    activeFile,
    openTabs,
    unsavedChanges,
    editorContent,
    editorTitle,
    savedContent,
  };

  // Load session state on initial mount
  useEffect(() => {
    invoke("load_session_state").then(session => {
      if (session && session.open_tabs) {
        setExpandedFolders(new Set(session.expanded_folders || []));
        
        const tabsWithNames = session.open_tabs.map(p => ({
          path: p,
          name: p.split('/').pop()
        }));
        
        setOpenTabs(tabsWithNames);
        
        if (tabsWithNames.length > 0) {
          setActiveFile(tabsWithNames[0].path);
        }
      }
    });
  }, []);

  // Load shortcuts map for hints and keep it fresh
  useEffect(() => {
    getActiveShortcuts().then(setKeymap).catch(console.error);
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch {}
    if (isTauri) {
      const sub = listen('shortcuts:updated', async () => {
        const m = await getActiveShortcuts();
        setKeymap(m);
      });
      return () => { sub.then((un) => un()); };
    } else {
      const onDom = async () => { setKeymap(await getActiveShortcuts()); };
      window.addEventListener('shortcuts:updated', onDom);
      return () => window.removeEventListener('shortcuts:updated', onDom);
    }
  }, []);

  // Save session state on change (debounced)
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      const tabPaths = openTabs.map(t => t.path);
      const folderPaths = Array.from(expandedFolders);
      invoke("save_session_state", { openTabs: tabPaths, expandedFolders: folderPaths });
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [openTabs, expandedFolders]);

  // Fetch file tree
  useEffect(() => {
    if (path) {
      try { window.__LOKUS_WORKSPACE_PATH__ = path; } catch {}
      invoke("read_workspace_files", { workspacePath: path })
        .then(files => {
          const filterIgnored = (entries) => {
            const ignoredNames = ['.lokus', '.DS_Store'];
            return entries
              .filter(entry => !ignoredNames.includes(entry.name))
              .map(entry => {
                if (entry.children) {
                  return { ...entry, children: filterIgnored(entry.children) };
                }
                return entry;
              });
          };
          const tree = filterIgnored(files);
          setFileTree(tree);
          // Build flat index for wiki suggestions
          const flat = [];
          const walk = (arr) => {
            for (const e of arr) {
              if (e.is_directory) { if (e.children) walk(e.children); }
              else flat.push({ title: e.name, path: e.path });
            }
          };
          walk(tree);
          try { window.__LOKUS_FILE_INDEX__ = flat; } catch {}
        })
        .catch(console.error);
    }
  }, [path, refreshId]);

  // Fetch content for active file
  useEffect(() => {
    if (activeFile) {
      try { window.__LOKUS_ACTIVE_FILE__ = activeFile; } catch {}
      const activeTab = openTabs.find(tab => tab.path === activeFile);
      if (activeTab) {
        invoke("read_file_content", { path: activeFile })
          .then(content => {
            setEditorContent(content);
            setEditorTitle(activeTab.name.replace(/\.md$/, ""));
            setSavedContent(content);
          })
          .catch(console.error);
      }
    } else {
      setEditorContent("");
      setEditorTitle("");
    }
  }, [activeFile]);

  useEffect(() => {
    const sub = listen("workspace:activate", (e) => {
      const newPath = String(e.payload || "");
      setPath(newPath);
      invoke("save_last_workspace", { path: newPath });
    });
    return () => { sub.then((un) => un()); };
  }, []);

  // Open file events from editor (wiki link clicks)
  useEffect(() => {
    const openPath = (p) => {
      if (!p) return;
      setOpenTabs(prevTabs => {
        const name = p.split('/').pop();
        const newTabs = prevTabs.filter(t => t.path !== p);
        newTabs.unshift({ path: p, name });
        if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
        return newTabs;
      });
      setActiveFile(p);
    };

    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch {}
    if (isTauri) {
      const un = listen('lokus:open-file', (e) => openPath(String(e.payload || '')));
      return () => { un.then(u => u()); };
    } else {
      const onDom = (e) => openPath(String(e.detail || ''));
      window.addEventListener('lokus:open-file', onDom);
      return () => window.removeEventListener('lokus:open-file', onDom);
    }
  }, []);

  const handleRefreshFiles = () => setRefreshId(id => id + 1);

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const handleFileOpen = (file) => {
    if (file.is_directory) return;

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== file.path);
      newTabs.unshift({ path: file.path, name: file.name });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(file.path);
  };

  const handleTabClick = (path) => {
    setActiveFile(path);
  };

  const handleTabClose = useCallback(async (path) => {
    const closeTab = () => {
      setOpenTabs(prevTabs => {
        const tabIndex = prevTabs.findIndex(t => t.path === path);
        const newTabs = prevTabs.filter(t => t.path !== path);
        
        if (stateRef.current.activeFile === path) {
          if (newTabs.length === 0) {
            setActiveFile(null);
          } else {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            setActiveFile(newTabs[newActiveIndex].path);
          }
        }
        return newTabs;
      });
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    };

    if (stateRef.current.unsavedChanges.has(path)) {
      const confirmed = await confirm("You have unsaved changes. Close without saving?", {
        title: "Unsaved Changes",
        type: "warning",
      });
      if (confirmed) {
        closeTab();
      }
    } else {
      closeTab();
    }
  }, []);

  const handleEditorChange = useCallback((newContent) => {
    setEditorContent(newContent);
    if (!stateRef.current.activeFile) return;
    setUnsavedChanges(prev => {
      const next = new Set(prev);
      if (newContent !== stateRef.current.savedContent) {
        next.add(stateRef.current.activeFile);
      } else {
        next.delete(stateRef.current.activeFile);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const { activeFile, openTabs, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;
    
    let path_to_save = activeFile;
    let needsStateUpdate = false;

    try {
      const currentTab = openTabs.find(t => t.path === activeFile);
      const currentName = currentTab.name.replace(/\.md$/, "");

      if (editorTitle !== currentName && editorTitle.trim() !== "") {
        const newFileName = `${editorTitle.trim()}.md`;
        const newPath = await invoke("rename_file", { path: activeFile, newName: newFileName });
        path_to_save = newPath;
        needsStateUpdate = true;
      }

      await invoke("write_file_content", { path: path_to_save, content: editorContent });
      setSavedContent(editorContent);
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeFile);
        newSet.delete(path_to_save);
        return newSet;
      });

      if (needsStateUpdate) {
        const newName = path_to_save.split("/").pop();
        setOpenTabs(tabs => tabs.map(t => t.path === activeFile ? { path: path_to_save, name: newName } : t));
        setActiveFile(path_to_save);
        handleRefreshFiles();
      }
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, []);

  const handleCreateFile = async () => {
    try {
      const newFilePath = await invoke("create_file_in_workspace", { workspacePath: path, name: "Untitled.md" });
      handleRefreshFiles();
      handleFileOpen({ path: newFilePath, name: "Untitled.md", is_directory: false });
    } catch (error) {
      console.error("Failed to create file:", error);
    }
  };

  const handleCreateFolder = () => {
    setIsCreatingFolder(true);
  };

  const handleConfirmCreateFolder = async (name) => {
    if (name) {
      try {
        await invoke("create_folder_in_workspace", { workspacePath: path, name });
        handleRefreshFiles();
      } catch (error) {
        console.error("Failed to create folder:", error);
      }
    }
    setIsCreatingFolder(false);
  };

  const handleTabDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOpenTabs((tabs) => {
        const oldIndex = tabs.findIndex((t) => t.path === active.id);
        const newIndex = tabs.findIndex((t) => t.path === over.id);
        if (oldIndex === -1 || newIndex === -1) return tabs;
        const newTabs = Array.from(tabs);
        const [removed] = newTabs.splice(oldIndex, 1);
        newTabs.splice(newIndex, 0, removed);
        return newTabs;
      });
    }
  };

  useEffect(() => {
    let isTauri = false; try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch {}
    const addDom = (name, fn) => { const h = () => fn(); window.addEventListener(name, h); return () => window.removeEventListener(name, h); };
    const unlistenSave = isTauri ? listen("lokus:save-file", handleSave) : Promise.resolve(addDom('lokus:save-file', handleSave));
    const unlistenClose = isTauri ? listen("lokus:close-tab", () => {
      if (stateRef.current.activeFile) {
        handleTabClose(stateRef.current.activeFile);
      }
    }) : Promise.resolve(addDom('lokus:close-tab', () => { if (stateRef.current.activeFile) handleTabClose(stateRef.current.activeFile); }));
    const unlistenNewFile = isTauri ? listen("lokus:new-file", handleCreateFile) : Promise.resolve(addDom('lokus:new-file', handleCreateFile));
    const unlistenNewFolder = isTauri ? listen("lokus:new-folder", () => setIsCreatingFolder(true)) : Promise.resolve(addDom('lokus:new-folder', () => setIsCreatingFolder(true)));
    const unlistenToggleSidebar = isTauri ? listen("lokus:toggle-sidebar", () => setShowLeft(v => !v)) : Promise.resolve(addDom('lokus:toggle-sidebar', () => setShowLeft(v => !v)));

    return () => {
      unlistenSave.then(f => { if (typeof f === 'function') f(); });
      unlistenClose.then(f => { if (typeof f === 'function') f(); });
      unlistenNewFile.then(f => { if (typeof f === 'function') f(); });
      unlistenNewFolder.then(f => { if (typeof f === 'function') f(); });
      unlistenToggleSidebar.then(f => { if (typeof f === 'function') f(); });
    };
  }, [handleSave, handleTabClose]);

  const cols = (() => {
    const mainContent = `minmax(0,1fr)`;
    const leftPanel = showLeft ? `${leftW}px 1px ` : "";
    return `48px 1px ${leftPanel}${mainContent}`;
  })();

  return (
    <div className="h-screen bg-app-panel text-app-text flex flex-col font-sans transition-colors duration-300 overflow-hidden">
      <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateColumns: cols }}>
        <aside className="flex flex-col items-center gap-2 py-2 border-r border-app-border">
          <button
            onClick={() => setShowLeft(v => !v)}
            title={showLeft ? "Hide sidebar" : "Show sidebar"}
            className={`p-2 rounded-md transition-colors ${showLeft ? 'bg-app-accent text-app-accent-fg' : 'text-app-muted hover:bg-app-bg'}`}
          >
            <Menu className="w-5 h-5" />
          </button>
        </aside>
        <div className="bg-app-border/20 w-px" />
        {showLeft && (
          <aside className="overflow-y-auto flex flex-col">
            <div className="h-12 shrink-0 px-4 flex items-center justify-between gap-2 border-b border-app-border">
              <span className="font-semibold text-sm">Files</span>
              <div className="flex items-center">
                <button onClick={handleCreateFile} title="New File" className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors">
                  <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="w-4 h-4" />
                </button>
                <button onClick={handleCreateFolder} title="New Folder" className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors">
                  <Icon path="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="p-2 flex-1 overflow-y-auto">
                  <FileTreeView 
                    entries={fileTree}
                    onFileClick={handleFileOpen} 
                    activeFile={activeFile}
                    onRefresh={handleRefreshFiles}
                    expandedFolders={expandedFolders}
                    toggleFolder={toggleFolder}
                    isCreating={isCreatingFolder}
                    onCreateConfirm={handleConfirmCreateFolder}
                    keymap={keymap}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={handleCreateFile}>
                  New File
                  <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-file'])}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCreateFolder}>
                  New Folder
                  <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleRefreshFiles}>Refresh</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </aside>
        )}
        {showLeft && <div onMouseDown={startLeftDrag} className="cursor-col-resize bg-app-border/20 hover:bg-app-accent/50 transition-colors duration-300 w-px" />}
        <main className="min-w-0 min-h-0 flex flex-col bg-app-bg">
          <TabBar 
            tabs={openTabs}
            activeTab={activeFile}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            unsavedChanges={unsavedChanges}
            onDragEnd={handleTabDragEnd}
            onNewTab={handleCreateFile}
          />
          <div className="flex-1 p-8 md:p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {activeFile ? (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div>
                      <input
                        type="text"
                        value={editorTitle}
                        onChange={(e) => setEditorTitle(e.target.value)}
                        className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                      />
                      <Editor
                        content={editorContent}
                        onContentChange={handleEditorChange}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={handleSave}>
                      Save
                      <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['save-file'])}</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => stateRef.current.activeFile && handleTabClose(stateRef.current.activeFile)}>
                      Close Tab
                      <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['close-tab'])}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => document.execCommand && document.execCommand('selectAll')}>Select All</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                <div className="mx-auto max-w-2xl text-center">
                  <div className="rounded-lg border border-app-border bg-app-panel/50 p-8">
                    <h1 className="text-2xl font-semibold">Welcome to Lokus</h1>
                    <p className="mt-2 text-app-muted">Create your first note or add a folder to get started.</p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={handleCreateFile}
                        className="inline-flex items-center gap-2 rounded-md border border-app-border bg-app-bg px-4 py-2 text-sm hover:bg-app-panel transition-colors"
                      >
                        <FilePlus2 className="w-4 h-4" />
                        New note
                      </button>
                      <button
                        onClick={handleCreateFolder}
                        className="inline-flex items-center gap-2 rounded-md border border-app-border bg-app-bg px-4 py-2 text-sm hover:bg-app-panel transition-colors"
                      >
                        <FolderPlus className="w-4 h-4" />
                        New folder
                      </button>
                      <button
                        onClick={handleRefreshFiles}
                        className="inline-flex items-center gap-2 rounded-md border border-app-border bg-app-bg px-4 py-2 text-sm hover:bg-app-panel transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        Refresh files
                      </button>
                    </div>

                    <div className="mt-6 text-left text-sm text-app-muted">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-md bg-app-bg/50 border border-app-border p-3">
                          <div className="font-medium text-app-text mb-1">Tips</div>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Press <span className="font-mono">Cmd/Ctrl + S</span> to save.</li>
                            <li>Rename a note by editing its title.</li>
                            <li>Drag files into folders to move them.</li>
                          </ul>
                        </div>
                        <div className="rounded-md bg-app-bg/50 border border-app-border p-3">
                          <div className="font-medium text-app-text mb-1">Recent activity</div>
                          <p>No recent notes yet.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
