import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { save } from "@tauri-apps/plugin-dialog";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

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

// --- Recursive File Entry ---
function FileEntry({ entry, level, onFileSelect, activeFile, expandedFolders, toggleFolder }) {
  const { attributes, listeners, setNodeRef: draggableRef, isDragging } = useDraggable({
    id: entry.path,
    data: { type: "file-entry", entry },
  });

  const { setNodeRef: droppableRef, isOver } = useDroppable({
    id: entry.path,
    data: { type: "folder-drop-target", entry },
    disabled: !entry.is_directory,
  });

  const isExpanded = expandedFolders[entry.path];
  const isDropTarget = isOver && entry.is_directory;

  const baseClasses = "w-full text-left px-2 py-1 text-sm rounded flex items-center gap-2 transition-colors";
  const stateClasses = activeFile === entry.path ? 'bg-app-accent/20 text-app-text' : 'text-app-muted hover:text-app-text hover:bg-app-bg';
  const dropTargetClasses = isDropTarget ? 'bg-app-accent/30 ring-2 ring-app-accent' : '';
  const draggingClasses = isDragging ? 'opacity-50' : '';

  return (
    <li style={{ paddingLeft: `${level * 1.25}rem` }}>
      <div ref={droppableRef} className="rounded">
        <div ref={draggableRef} {...listeners} {...attributes}>
          <button
            onClick={() => onFileSelect(entry)}
            className={`${baseClasses} ${stateClasses} ${dropTargetClasses} ${draggingClasses}`}
          >
            {entry.is_directory ? (
              <Icon path={isExpanded ? "M19.5 8.25l-7.5 7.5-7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} className="w-4 h-4" />
            ) : (
              <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="w-4 h-4" />
            )}
            <span>{entry.name}</span>
          </button>
        </div>
      </div>
      {isExpanded && entry.children && (
        <ul className="space-y-1 mt-1">
          {entry.children.map(child => (
            <FileEntry
              key={child.path}
              entry={child}
              level={level + 1}
              onFileSelect={onFileSelect}
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

// --- File Tree Container ---
function FileTree({ entries, onFileSelect, activeFile, onRefresh, expandedFolders, toggleFolder, isCreating, onCreateConfirm }) {
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
    <DndContext onDragEnd={handleDragEnd}>
      <ul className="space-y-1">
        {isCreating && <NewFolderInput onConfirm={onCreateConfirm} level={0} />}
        {entries.map(entry => (
          <FileEntry
            key={entry.path}
            entry={entry}
            level={0}
            onFileSelect={onFileSelect}
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        ))}
      </ul>
    </DndContext>
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
  const [expandedFolders, setExpandedFolders] = useState({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const editorContentRef = useRef(null);

  useEffect(() => {
    if (path) {
      invoke("read_workspace_files", { workspacePath: path })
        .then(setFileTree)
        .catch(console.error);
    }
  }, [path, refreshId]);

  useEffect(() => {
    const sub = listen("workspace:activate", (e) => setPath(String(e.payload || "")));
    return () => { sub.then((un) => un()); };
  }, []);

  const handleRefreshFiles = () => setRefreshId(id => id + 1);

  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleFileSelect = async (file) => {
    if (file.is_directory) {
      toggleFolder(file.path);
      return;
    }
    try {
      const content = await invoke("read_file_content", { path: file.path });
      setActiveFile(file.path);
      setEditorContent(content);
      setEditorTitle(file.name.replace(/\.md$/, ""));
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  };

  const handleSave = async () => {
    if (!activeFile && editorContent === "") return;
    let path_to_save = activeFile;
    let needsStateUpdate = false;

    try {
      if (!activeFile) {
        const newPath = await save({
          title: "Save As",
          defaultPath: `${path}/${editorTitle || "Untitled"}.md`,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (!newPath) return;
        path_to_save = newPath;
        needsStateUpdate = true;
      } else {
        const currentName = activeFile.split("/").pop().replace(/\.md$/, "");
        if (editorTitle !== currentName && editorTitle.trim() !== "") {
          const newFileName = `${editorTitle.trim()}.md`;
          const newPath = await invoke("rename_file", { path: activeFile, newName: newFileName });
          path_to_save = newPath;
          needsStateUpdate = true;
        }
      }

      await invoke("write_file_content", { path: path_to_save, content: editorContent });

      if (needsStateUpdate) {
        const newName = path_to_save.split("/").pop();
        setActiveFile(path_to_save);
        setEditorTitle(newName.replace(/\.md$/, ""));
        handleRefreshFiles();
      }
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  };

  const handleCreateFile = async () => {
    try {
      const newFilePath = await invoke("create_file_in_workspace", { workspacePath: path, name: "Untitled.md" });
      handleRefreshFiles();
      handleFileSelect({ path: newFilePath, name: "Untitled.md", is_directory: false });
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
    register("CommandOrControl+S", handleSave);
    return () => {
      unregisterAll();
    };
  }, [handleSave]);

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
            <Icon path="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
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
              <FileTree 
                entries={fileTree}
                onFileSelect={handleFileSelect} 
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
          <div className="h-12 shrink-0 flex items-center justify-between border-b border-app-border px-4">
            <div className="flex items-center gap-2 text-sm text-app-muted">
              <span>{path?.split("/").pop() || "Workspace"}</span>
              <span>/</span>
              <span className="text-app-text font-medium">{activeFile ? activeFile.split('/').pop() : 'No file selected'}</span>
            </div>
            <button onClick={() => setShowRight((v) => !v)} className="p-2 rounded-md text-app-muted hover:bg-app-panel hover:text-app-text transition-colors">
              <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" className="w-4 h-4" />
            </button>
          </div>
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
                  <div 
                    ref={editorContentRef}
                    className="min-h-full leading-relaxed outline-none whitespace-pre-wrap text-base" 
                    contentEditable 
                    dangerouslySetInnerHTML={{ __html: editorContent }}
                    onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                    suppressContentEditableWarning
                  />
                </>
              ) : (
                <div className="text-center text-app-muted">Select a file to begin editing.</div>
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