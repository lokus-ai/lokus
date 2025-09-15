import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { DraggableTab } from "./DraggableTab";
import { Menu, FilePlus2, FolderPlus, Search, Share2, LayoutGrid, FolderMinus, Puzzle, FolderOpen, FilePlus, Layers, Package } from "lucide-react";
import LokusLogo from "../components/LokusLogo.jsx";
// import GraphView from "./GraphView.jsx"; // Temporarily disabled
import Editor from "../editor";
import Canvas from "./Canvas.jsx";
import FileContextMenu from "../components/FileContextMenu.jsx";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/context-menu.jsx";
import { getActiveShortcuts, formatAccelerator } from "../core/shortcuts/registry.js";
import CommandPalette from "../components/CommandPalette.jsx";
import InFileSearch from "../components/InFileSearch.jsx";
import SearchPanel from "../components/SearchPanel.jsx";
import MiniKanban from "../components/MiniKanban.jsx";
import FullKanban from "../components/FullKanban.jsx";
import PluginSettings from "./PluginSettings.jsx";
import Marketplace from "./Marketplace.jsx";
import PluginDetail from "./PluginDetail.jsx";
import { canvasManager } from "../core/canvas/manager.js";

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


  const startLeftDrag = useCallback((e) => { 
    dragRef.current = { side: "left", startX: e.clientX, left0: leftW, right0: rightW };
    
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setLeftW(Math.min(maxLeft, Math.max(minLeft, d.left0 + (e.clientX - d.startX))));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftW, rightW, maxLeft, minLeft]);
  
  const startRightDrag = useCallback((e) => { 
    dragRef.current = { side: "right", startX: e.clientX, left0: leftW, right0: rightW };
    
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setRightW(Math.min(maxRight, Math.max(minRight, d.right0 - (e.clientX - d.startX))));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftW, rightW, maxRight, minRight]);

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

  const baseClasses = "obsidian-file-item";
  const stateClasses = activeFile === entry.path ? 'active' : '';
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

  const handleFileContextAction = async (action, data) => {
    const { file } = data;
    
    switch (action) {
      case 'open':
        onFileClick(file);
        break;
      case 'openToSide':
        // TODO: Implement open to side functionality
        console.log('Open to side:', file.path);
        break;
      case 'openWith':
        // TODO: Implement open with functionality
        console.log('Open with:', file.path);
        break;
      case 'revealInFinder':
        try {
          await invoke('reveal_in_finder', { path: file.path });
        } catch (e) {
          console.error('Failed to reveal in finder:', e);
        }
        break;
      case 'openInTerminal':
        try {
          const terminalPath = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
          await invoke('open_terminal', { path: terminalPath });
        } catch (e) {
          console.error('Failed to open terminal:', e);
        }
        break;
      case 'cut':
        // TODO: Implement cut functionality
        console.log('Cut:', file.path);
        break;
      case 'copy':
        // TODO: Implement copy functionality
        console.log('Copy:', file.path);
        break;
      case 'copyPath':
        try {
          await navigator.clipboard.writeText(file.path);
        } catch (e) {
          console.error('Failed to copy path:', e);
        }
        break;
      case 'copyRelativePath':
        try {
          // TODO: Calculate relative path from workspace root
          const relativePath = file.path; // Simplified for now
          await navigator.clipboard.writeText(relativePath);
        } catch (e) {
          console.error('Failed to copy relative path:', e);
        }
        break;
      case 'rename':
        onRename();
        break;
      case 'delete':
        try {
          const confirmed = await confirm(`Are you sure you want to delete "${file.name}"?`);
          if (confirmed) {
            await invoke('delete_file', { path: file.path });
            onRefresh && onRefresh();
          }
        } catch (e) {
          console.error('Failed to delete:', e);
        }
        break;
      case 'selectForCompare':
        // TODO: Implement select for compare
        console.log('Select for compare:', file.path);
        break;
      case 'shareEmail':
      case 'shareSlack':
      case 'shareTeams':
        // TODO: Implement sharing functionality
        console.log('Share:', action, file.path);
        break;
      default:
        console.log('Unhandled action:', action, file.path);
    }
  };

  return (
    <li style={{ paddingLeft: `${level * 1.25}rem` }}>
      <div ref={droppableRef} className="rounded">
        <div ref={draggableRef} className="flex items-center">
          <FileContextMenu 
            file={{ ...entry, type: entry.is_directory ? 'folder' : 'file' }} 
            onAction={handleFileContextAction}
          >
            <button {...listeners} {...attributes} onClick={handleClick} className={`${baseClasses} ${stateClasses} ${dropTargetClasses} ${draggingClasses}`}>
              {entry.is_directory ? (
                <Icon path={isExpanded ? "M19.5 8.25l-7.5 7.5-7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} className="obsidian-file-icon" />
              ) : (
                <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="obsidian-file-icon" />
              )}
              <span className="truncate">{entry.name}</span>
            </button>
          </FileContextMenu>
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
      <div className="h-9 shrink-0 flex items-end bg-app-panel border-b border-app-border px-0">
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
          title="New file (⌘N)"
          className="obsidian-button icon-only ml-2 mb-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
  const [showMiniKanban, setShowMiniKanban] = useState(false);
  const [refreshId, setRefreshId] = useState(0);

  const [fileTree, setFileTree] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  // Check if we're in test mode
  const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
  const [keymap, setKeymap] = useState({});
  
  const [openTabs, setOpenTabs] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [showGraph, setShowGraph] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showInFileSearch, setShowInFileSearch] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  
  // --- Refs for stable callbacks ---
  const stateRef = useRef({});
  const editorRef = useRef(null);
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
    if (path) {
      invoke("load_session_state", { workspacePath: path }).then(session => {
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
    }
  }, [path]);

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
      if (path) {
        const tabPaths = openTabs.map(t => t.path);
        const folderPaths = Array.from(expandedFolders);
        invoke("save_session_state", { workspacePath: path, openTabs: tabPaths, expandedFolders: folderPaths });
      }
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [openTabs, expandedFolders, path]);

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

  // Tab navigation shortcuts (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+W)
  useEffect(() => {
    const handleNextTab = () => {
      if (openTabs.length <= 1) return;
      const currentIndex = openTabs.findIndex(tab => tab.path === activeFile);
      const nextIndex = (currentIndex + 1) % openTabs.length;
      setActiveFile(openTabs[nextIndex].path);
    };

    const handlePrevTab = () => {
      if (openTabs.length <= 1) return;
      const currentIndex = openTabs.findIndex(tab => tab.path === activeFile);
      const prevIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
      setActiveFile(openTabs[prevIndex].path);
    };


    let isTauri = false; 
    try { isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__); } catch {}
    
    if (isTauri) {
      const nextTabSub = listen('lokus:next-tab', handleNextTab);
      const prevTabSub = listen('lokus:prev-tab', handlePrevTab);
      return () => {
        nextTabSub.then(u => u());
        prevTabSub.then(u => u());
      };
    } else {
      const onNextTab = () => handleNextTab();
      const onPrevTab = () => handlePrevTab();
      
      window.addEventListener('lokus:next-tab', onNextTab);
      window.addEventListener('lokus:prev-tab', onPrevTab);
      
      return () => {
        window.removeEventListener('lokus:next-tab', onNextTab);
        window.removeEventListener('lokus:prev-tab', onPrevTab);
      };
    }
  }, [openTabs, activeFile]);

  const handleRefreshFiles = () => setRefreshId(id => id + 1);

  const handleOpenPluginDetail = (plugin) => {
    const pluginPath = `__plugin_${plugin.id}__`;
    const pluginName = `${plugin.name} Plugin`;
    
    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== pluginPath);
      newTabs.unshift({ path: pluginPath, name: pluginName, plugin });
      if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
      return newTabs;
    });
    setActiveFile(pluginPath);
  };

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

  const closeAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const handleFileOpen = (file) => {
    // Handle search result format with line numbers
    if (file.path && file.lineNumber !== undefined) {
      const filePath = file.path;
      const fileName = filePath.split('/').pop();
      
      setOpenTabs(prevTabs => {
        const newTabs = prevTabs.filter(t => t.path !== filePath);
        newTabs.unshift({ path: filePath, name: fileName });
        if (newTabs.length > MAX_OPEN_TABS) {
          newTabs.pop();
        }
        return newTabs;
      });
      setActiveFile(filePath);
      
      // Jump to line after editor loads
      setTimeout(() => {
        if (editorRef.current && file.lineNumber) {
          try {
            const doc = editorRef.current.state.doc;
            const linePos = doc.line(file.lineNumber).from + (file.column || 0);
            const selection = editorRef.current.state.selection.constructor.create(doc, linePos, linePos);
            const tr = editorRef.current.state.tr.setSelection(selection);
            editorRef.current.view.dispatch(tr);
            editorRef.current.commands.scrollIntoView();
          } catch (error) {
            console.error('Error jumping to line:', error);
          }
        }
      }, 100);
      return;
    }
    
    // Handle regular file format
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

  const handleOpenFullKanban = () => {
    const kanbanPath = '__kanban__';
    const kanbanName = 'Task Board';
    
    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== kanbanPath);
      newTabs.unshift({ path: kanbanPath, name: kanbanName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(kanbanPath);
    setShowKanban(false); // Close mini kanban when opening full
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

  const handleCreateCanvas = async () => {
    try {
      const newCanvasPath = await canvasManager.createCanvas(path, "Untitled Canvas");
      handleRefreshFiles();
      handleFileOpen({ path: newCanvasPath, name: "Untitled Canvas.canvas", is_directory: false });
    } catch (error) {
      console.error("Failed to create canvas:", error);
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
    const unlistenCommandPalette = isTauri ? listen("lokus:command-palette", () => setShowCommandPalette(true)) : Promise.resolve(addDom('lokus:command-palette', () => setShowCommandPalette(true)));
    const unlistenInFileSearch = isTauri ? listen("lokus:in-file-search", () => setShowInFileSearch(true)) : Promise.resolve(addDom('lokus:in-file-search', () => setShowInFileSearch(true)));
    const unlistenGlobalSearch = isTauri ? listen("lokus:global-search", () => setShowGlobalSearch(true)) : Promise.resolve(addDom('lokus:global-search', () => setShowGlobalSearch(true)));

    return () => {
      unlistenSave.then(f => { if (typeof f === 'function') f(); });
      unlistenClose.then(f => { if (typeof f === 'function') f(); });
      unlistenNewFile.then(f => { if (typeof f === 'function') f(); });
      unlistenNewFolder.then(f => { if (typeof f === 'function') f(); });
      unlistenToggleSidebar.then(f => { if (typeof f === 'function') f(); });
      unlistenCommandPalette.then(f => { if (typeof f === 'function') f(); });
      unlistenInFileSearch.then(f => { if (typeof f === 'function') f(); });
      unlistenGlobalSearch.then(f => { if (typeof f === 'function') f(); });
    };
  }, [handleSave, handleTabClose]);

  const cols = (() => {
    const mainContent = `minmax(0,1fr)`;
    const leftPanel = showLeft ? `${leftW}px 1px ` : "";
    return `48px 1px ${leftPanel}${mainContent}`;
  })();

  return (
    <div className="h-screen bg-app-panel text-app-text flex flex-col font-sans transition-colors duration-300 overflow-hidden no-select">
      {/* Test Mode Indicator */}
      {isTestMode && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-md text-sm font-medium z-50">
          🧪 Test Mode Active
        </div>
      )}
      <div className="flex-1 min-h-0 grid overflow-hidden" style={{ gridTemplateColumns: cols }}>
        <aside className="flex flex-col items-center gap-1 py-3 border-r border-app-border bg-app-panel">
          {/* Menu Toggle */}
          <button
            onClick={() => setShowLeft(v => !v)}
            title={showLeft ? "Hide sidebar" : "Show sidebar"}
            className={`obsidian-button icon-only mb-2 ${showLeft ? 'primary' : ''}`}
          >
            <LokusLogo className="w-6 h-6" />
          </button>
          
          {/* Activity Bar - VS Code Style */}
          <div className="w-full border-t border-app-border/50 pt-2">
            <button
              onClick={() => { 
                setShowKanban(false); 
                setShowPlugins(false); 
                setShowMarketplace(false);
                setShowLeft(true);
              }}
              title="Explorer"
              className={`obsidian-button icon-only w-full mb-1 ${!showKanban && !showPlugins && !showMarketplace && showLeft ? 'primary' : ''}`}
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => { 
                setShowKanban(true); 
                setShowPlugins(false); 
                setShowMarketplace(false);
                setShowLeft(true);
              }}
              title="Task Board"
              className={`obsidian-button icon-only w-full mb-1 ${showKanban && !showPlugins && !showMarketplace ? 'primary' : ''}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => { 
                setShowPlugins(true); 
                setShowKanban(false);
                setShowMarketplace(false);
                setShowLeft(true);
              }}
              title="Extensions"
              className={`obsidian-button icon-only w-full mb-1 ${showPlugins && !showKanban && !showMarketplace ? 'primary' : ''}`}
            >
              <Puzzle className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => { 
                setShowMarketplace(true); 
                setShowPlugins(false); 
                setShowKanban(false);
                setShowLeft(true);
              }}
              title="Plugin Marketplace"
              className={`obsidian-button icon-only w-full ${showMarketplace ? 'primary' : ''}`}
            >
              <Package className="w-5 h-5" />
            </button>
          </div>
        </aside>
        <div className="bg-app-border/20 w-px" />
        {showLeft && (
          <aside className="overflow-y-auto flex flex-col">
            {/* Clean Header with Title and Actions - Hide for Kanban and Marketplace */}
            {!showKanban && !showMarketplace && (
              <div className="h-12 shrink-0 px-4 flex items-center justify-between gap-2 border-b border-app-border">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-medium text-app-text">
                    {showPlugins ? 'Extensions' : 'Explorer'}
                  </h2>
                  {!showPlugins && (
                    <button onClick={closeAllFolders} title="Close all folders" className="obsidian-button small icon-only">
                      <FolderMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!showPlugins && (
                  <div className="flex items-center gap-1">
                    <button onClick={handleCreateFile} title="New File" className="obsidian-button small icon-only">
                      <FilePlus className="w-4 h-4" />
                    </button>
                    <button onClick={handleCreateCanvas} title="New Canvas" className="obsidian-button small icon-only">
                      <Layers className="w-4 h-4" />
                    </button>
                    <button onClick={handleCreateFolder} title="New Folder" className="obsidian-button small icon-only">
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
            {showPlugins ? (
              <div className="flex-1 overflow-hidden">
                <PluginSettings onOpenPluginDetail={handleOpenPluginDetail} />
              </div>
            ) : showKanban ? (
              <div className="flex-1 overflow-hidden">
                <MiniKanban 
                  workspacePath={path}
                  onOpenFull={handleOpenFullKanban}
                />
              </div>
            ) : (
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="p-2 flex-1 overflow-y-auto">
                    <FileTreeView 
                      entries={fileTree}
                      onFileClick={handleFileOpen} 
                      activeFile={activeFile}
                      onRefresh={handleRefreshFiles}
                      data-testid="file-tree"
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
                  <ContextMenuItem onClick={handleCreateCanvas}>
                    New Canvas
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleCreateFolder}>
                    New Folder
                    <span className="ml-auto text-xs text-app-muted">{formatAccelerator(keymap['new-folder'])}</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleRefreshFiles}>Refresh</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )}
          </aside>
        )}
        {showLeft && <div onMouseDown={startLeftDrag} className="cursor-col-resize bg-app-border hover:bg-app-accent transition-colors duration-300 w-1 min-h-full" />}
        <main className="min-w-0 min-h-0 flex flex-col bg-app-bg">
          {/* Show marketplace as full-screen view when marketplace is active */}
          {showMarketplace ? (
            <Marketplace />
          ) : (
            <>
              <TabBar 
                tabs={openTabs}
                activeTab={activeFile}
                onTabClick={handleTabClick}
                onTabClose={handleTabClose}
                unsavedChanges={unsavedChanges}
                onDragEnd={handleTabDragEnd}
                onNewTab={handleCreateFile}
              />
              {activeFile === '__kanban__' ? (
            <div className="flex-1 bg-app-panel overflow-hidden">
              <FullKanban 
                workspacePath={path}
                onFileOpen={handleFileOpen}
              />
            </div>
          ) : activeFile && activeFile.endsWith('.canvas') ? (
            <div className="flex-1 overflow-hidden">
              <Canvas
                canvasPath={activeFile}
                canvasName={openTabs.find(tab => tab.path === activeFile)?.name}
                onSave={async (canvasData) => {
                  try {
                    await canvasManager.saveCanvas(activeFile, canvasData);
                    setUnsavedChanges(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(activeFile);
                      return newSet;
                    });
                  } catch (error) {
                    console.error("Failed to save canvas:", error);
                  }
                }}
                onContentChange={(canvasData) => {
                  setUnsavedChanges(prev => {
                    const newSet = new Set(prev);
                    newSet.add(activeFile);
                    return newSet;
                  });
                }}
                initialData={null} // Will be loaded by Canvas component
              />
            </div>
          ) : (
            <div className="flex-1 p-8 md:p-12 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {activeFile === '__graph__' ? (
                  <div className="flex items-center justify-center h-64 text-center">
                    <div>
                      <div className="text-4xl mb-4 text-app-muted/50">📊</div>
                      <h2 className="text-xl font-medium text-app-text mb-2">Graph View Coming Soon</h2>
                      <p className="text-app-muted">The graph view is temporarily disabled while we improve it.</p>
                    </div>
                  </div>
                ) : activeFile && activeFile.startsWith('__plugin_') ? (
                  <div className="flex-1 overflow-hidden">
                    {(() => {
                      const activeTab = openTabs.find(tab => tab.path === activeFile);
                      return activeTab?.plugin ? <PluginDetail plugin={activeTab.plugin} /> : <div>Plugin not found</div>;
                    })()}
                  </div>
                ) : activeFile ? (
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
                        ref={editorRef}
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
                <>
                  {/* Modern Welcome Screen - VS Code Inspired */}
                  <div className="h-full flex flex-col">
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="max-w-4xl w-full">
                      
                      {/* Header Section */}
                      <div className="text-center mb-10">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-app-accent/20 to-app-accent/10 border border-app-accent/20 flex items-center justify-center">
                          <LokusLogo className="w-10 h-10 text-app-accent" />
                        </div>
                        <h1 className="text-3xl font-bold text-app-text mb-2">Welcome to Lokus</h1>
                        <p className="text-app-muted text-lg">Your modern knowledge management platform</p>
                      </div>

                      {/* Quick Actions */}
                      <div className="mb-12">
                        <h2 className="text-lg font-semibold text-app-text mb-6">Start</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <button
                            onClick={handleCreateFile}
                            className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                              <FilePlus2 className="w-5 h-5 text-app-accent" />
                            </div>
                            <h3 className="font-medium text-app-text mb-2">New Note</h3>
                            <p className="text-sm text-app-muted">Create your first note and start writing</p>
                            <div className="mt-3 text-xs text-app-muted/70">⌘N</div>
                          </button>
                          
                          <button
                            onClick={handleCreateCanvas}
                            className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                              <Layers className="w-5 h-5 text-app-accent" />
                            </div>
                            <h3 className="font-medium text-app-text mb-2">New Canvas</h3>
                            <p className="text-sm text-app-muted">Create visual mind maps and diagrams</p>
                          </button>
                          
                          <button
                            onClick={handleCreateFolder}
                            className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                              <FolderPlus className="w-5 h-5 text-app-accent" />
                            </div>
                            <h3 className="font-medium text-app-text mb-2">New Folder</h3>
                            <p className="text-sm text-app-muted">Organize your notes with folders</p>
                            <div className="mt-3 text-xs text-app-muted/70">⌘⇧N</div>
                          </button>
                          
                          <button
                            onClick={() => setShowCommandPalette(true)}
                            className="group p-6 rounded-xl border border-app-border bg-app-panel/30 hover:bg-app-panel/50 hover:border-app-accent/40 transition-all duration-200 text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-app-accent/10 group-hover:bg-app-accent/20 flex items-center justify-center mb-4 transition-colors">
                              <Search className="w-5 h-5 text-app-accent" />
                            </div>
                            <h3 className="font-medium text-app-text mb-2">Command Palette</h3>
                            <p className="text-sm text-app-muted">Quick access to all commands</p>
                            <div className="mt-3 text-xs text-app-muted/70">⌘K</div>
                          </button>
                        </div>
                      </div>

                      {/* Recent & Help */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                          <h2 className="text-lg font-semibold text-app-text mb-4">Recent</h2>
                          <div className="space-y-2">
                            <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                              <p className="text-sm text-app-muted">No recent files yet. Start by creating your first note!</p>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h2 className="text-lg font-semibold text-app-text mb-4">Learn</h2>
                          <div className="space-y-3">
                            <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                              <h3 className="font-medium text-app-text text-sm mb-2">✨ Features</h3>
                              <ul className="text-sm text-app-muted space-y-1">
                                <li>• Rich text editing with math equations</li>
                                <li>• Wiki-style linking with <code className="px-1 py-0.5 bg-app-bg/50 rounded text-xs">[[brackets]]</code></li>
                                <li>• Task management and kanban boards</li>
                                <li>• Plugin system for extensibility</li>
                              </ul>
                            </div>
                            
                            <div className="p-4 rounded-lg bg-app-panel/20 border border-app-border/50">
                              <h3 className="font-medium text-app-text text-sm mb-2">⌨️ Quick Tips</h3>
                              <ul className="text-sm text-app-muted space-y-1">
                                <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">⌘K</kbd> Command palette</li>
                                <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">⌘S</kbd> Save current file</li>
                                <li>• <kbd className="px-1.5 py-0.5 bg-app-bg/50 rounded text-xs">⌘P</kbd> Quick file open</li>
                                <li>• Drag files to move them between folders</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </>
              )}
              </div>
            </div>
          )}
            </>
          )}
        </main>
      </div>
      
      <CommandPalette
        open={showCommandPalette}
        setOpen={setShowCommandPalette}
        fileTree={fileTree}
        openFiles={openTabs}
        onFileOpen={handleFileOpen}
        onCreateFile={handleCreateFile}
        onCreateFolder={() => setIsCreatingFolder(true)}
        onSave={handleSave}
        onOpenPreferences={() => {
          const openPreferences = () => {
            (async () => {
              try {
                const { emit } = await import('@tauri-apps/api/event');
                await emit('preferences:open');
              } catch {
                try { window.dispatchEvent(new CustomEvent('preferences:open')); } catch {}
              }
            })();
          };
          openPreferences();
        }}
        onToggleSidebar={() => setShowLeft(v => !v)}
        onCloseTab={handleTabClose}
        activeFile={activeFile}
      />
      
      <InFileSearch
        editor={editorRef.current}
        isVisible={showInFileSearch}
        onClose={() => setShowInFileSearch(false)}
      />
      
      <SearchPanel
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onFileOpen={handleFileOpen}
        workspacePath={path}
      />
      
      {/* Enhanced Obsidian Status Bar */}
      <div className="obsidian-status-bar">
        <div className="obsidian-status-bar-section">
          <div className="obsidian-status-bar-item">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Ready</span>
          </div>
          {activeFile && (
            <>
              <div className="obsidian-status-bar-separator" />
              <div className="obsidian-status-bar-item">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span>{activeFile.split('/').pop()}</span>
              </div>
            </>
          )}
          <div className="obsidian-status-bar-separator" />
          <div className="obsidian-status-bar-item">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span>{openTabs.length} {openTabs.length === 1 ? 'file' : 'files'}</span>
          </div>
        </div>
        
        <div className="obsidian-status-bar-section">
          {unsavedChanges.size > 0 && (
            <>
              <div className="obsidian-status-bar-item active">
                <div className="w-2 h-2 rounded-full bg-current" />
                <span>{unsavedChanges.size} unsaved</span>
              </div>
              <div className="obsidian-status-bar-separator" />
            </>
          )}
          <div className="obsidian-status-bar-item clickable">
            <span>Markdown</span>
          </div>
          <div className="obsidian-status-bar-separator" />
          <div className="obsidian-status-bar-item clickable">
            <span>UTF-8</span>
          </div>
          <div className="obsidian-status-bar-separator" />
          <div className="obsidian-status-bar-item clickable">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span>Settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
