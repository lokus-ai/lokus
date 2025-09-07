import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { save as saveDialog, confirm } from "@tauri-apps/plugin-dialog";
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import Editor from "../editor";

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
function FileEntryComponent({ entry, level, onFileClick, activeFile, expandedFolders, toggleFolder }) {
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

  return (
    <li style={{ paddingLeft: `${level * 1.25}rem` }}>
      <div ref={droppableRef} className="rounded">
        <div ref={draggableRef} className="flex items-center">
          <button {...listeners} {...attributes} onClick={handleClick} className={`${baseClasses} ${stateClasses} ${dropTargetClasses} ${draggingClasses}`}>
            {entry.is_directory ? (
              <Icon path={isExpanded ? "M19.5 8.25l-7.5 7.5-7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">{entry.name}</span>
          </button>
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
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- File Tree View Component ---
function FileTreeView({ entries, onFileClick, activeFile, onRefresh, expandedFolders, toggleFolder, isCreating, onCreateConfirm }) {
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
          />
        ))}
      </ul>
    </DndContext>
  );
}

// --- Tab Bar Component ---
function TabBar({ tabs, activeTab, onTabClick, onTabClose, unsavedChanges }) {
  return (
    <div className="h-12 shrink-0 flex items-center border-b border-app-border px-2 gap-2">
      {tabs.map(tab => {
        const isUnsaved = unsavedChanges.has(tab.path);
        return (
          <div
            key={tab.path}
            onClick={() => onTabClick(tab.path)}
            className={`group h-full flex items-center px-3 text-sm border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.path
                ? 'border-app-accent text-app-text'
                : 'border-transparent text-app-muted hover:text-app-text'
            }`}
          >
            <span>{tab.name.replace(/\.md$/, "")}</span>
            <div className="w-4 h-4 ml-2 flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.path);
                }}
                className={`p-0.5 rounded hover:bg-app-bg ${isUnsaved ? 'invisible group-hover:visible' : 'invisible group-hover:visible'}`}
              >
                <Icon path="M6 18L18 6M6 6l12 12" className="w-3.5 h-3.5" />
              </button>
              {isUnsaved && (
                <div className="w-2 h-2 rounded-full bg-app-text group-hover:hidden"></div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Workspace Component ---
export default function Workspace({ initialPath = "" }) {
  const [path, setPath] = useState(initialPath);
  const { leftW, rightW, startLeftDrag, startRightDrag } = useDragColumns({});
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [refreshId, setRefreshId] = useState(0);

  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  const [openTabs, setOpenTabs] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const saveTimeoutRef = useRef(null);
  const activeFileRef = useRef(activeFile);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

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

  // Save session state on change (debounced)
  useEffect(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const tabPaths = openTabs.map(t => t.path);
      const folderPaths = Array.from(expandedFolders);
      invoke("save_session_state", { openTabs: tabPaths, expandedFolders: folderPaths });
    }, 500);
  }, [openTabs, expandedFolders]);

  // Fetch file tree
  useEffect(() => {
    if (path) {
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
          setFileTree(filterIgnored(files));
        })
        .catch(console.error);
    }
  }, [path, refreshId]);

  // Fetch content for active file
  useEffect(() => {
    if (activeFile) {
      const activeTab = openTabs.find(tab => tab.path === activeFile);
      if (activeTab) {
        invoke("read_file_content", { path: activeFile })
          .then(content => {
            setEditorContent(content);
            setEditorTitle(activeTab.name.replace(/\.md$/, ""));
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
        
        if (activeFileRef.current === path) {
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

    if (unsavedChanges.has(path)) {
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
  }, [unsavedChanges]);

  const handleEditorChange = useCallback((newContent) => {
    setEditorContent(newContent);
    if (activeFileRef.current) {
      setUnsavedChanges(prev => new Set(prev).add(activeFileRef.current));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeFileRef.current) return;
    let path_to_save = activeFileRef.current;
    let needsStateUpdate = false;

    try {
      const currentTab = openTabs.find(t => t.path === activeFileRef.current);
      const currentName = currentTab.name.replace(/\.md$/, "");

      if (editorTitle !== currentName && editorTitle.trim() !== "") {
        const newFileName = `${editorTitle.trim()}.md`;
        const newPath = await invoke("rename_file", { path: activeFileRef.current, newName: newFileName });
        path_to_save = newPath;
        needsStateUpdate = true;
      }

      await invoke("write_file_content", { path: path_to_save, content: editorContent });
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeFileRef.current);
        newSet.delete(path_to_save);
        return newSet;
      });

      if (needsStateUpdate) {
        const newName = path_to_save.split("/").pop();
        setOpenTabs(tabs => tabs.map(t => t.path === activeFileRef.current ? { path: path_to_save, name: newName } : t));
        setActiveFile(path_to_save);
        handleRefreshFiles();
      }
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [editorContent, editorTitle, openTabs]);

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

  useEffect(() => {
    const registerShortcuts = async () => {
      await unregisterAll();
      await register("CommandOrControl+S", handleSave);
      await register("CommandOrControl+W", () => {
        if (activeFileRef.current) {
          handleTabClose(activeFileRef.current);
        }
      });
    };
    registerShortcuts().catch(console.error);
    return () => {
      unregisterAll();
    };
  }, [handleSave, handleTabClose]);

  const cols = (() => {
    const mainContent = `minmax(0,1fr)`;
    const leftPanel = showLeft ? `${leftW}px 1px ` : "";
    const rightPanel = showRight ? ` 1px ${rightW}px` : "";
    return `48px 1px ${leftPanel}${mainContent}${rightPanel}`;
  })();

  return (
    <div className="h-screen bg-app-panel text-app-text flex flex-col font-sans transition-colors duration-300">
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: cols }}>
        <aside className="flex flex-col items-center gap-2 py-2 border-r border-app-border">
          <button onClick={() => setShowLeft(v => !v)} className={`p-2 rounded-md transition-colors ${showLeft ? 'bg-app-accent text-app-accent-fg' : 'text-app-muted hover:bg-app-bg'}`}>
            <Icon path="M3.75 5.25h16.5m-1.5 4.5h16.5m-1.5 4.5h16.5m-1.5 4.5h16.5" />
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
              />
            </div>
          </aside>
        )}
        {showLeft && <div onMouseDown={startLeftDrag} className="cursor-col-resize bg-app-border/20 hover:bg-app-accent/50 transition-colors duration-300 w-px" />}
        <main className="min-w-0 flex flex-col bg-app-bg">
          <TabBar 
            tabs={openTabs}
            activeTab={activeFile}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            unsavedChanges={unsavedChanges}
          />
          <div className="flex-1 p-8 md:p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {activeFile ? (
                <>
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
                </>
              ) : (
                <div className="text-center text-app-muted">Select a file to begin editing or create a new one.</div>
              )}
            </div>
          </div>
        </main>
        {showRight && <div onMouseDown={startRightDrag} className="cursor-col-resize bg-app-border/20 hover:bg-app-accent/50 transition-colors duration-300 w-px" />}
        {showRight && (
          <aside className="overflow-y-auto flex flex-col">
            <div className="h-12 shrink-0 px-4 flex items-center gap-2 border-b border-l border-app-border">
              <span className="font-semibold text-sm">Inspector</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}