import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { loadThemeForWorkspace } from "../core/theme/manager.js";

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

// --- File Tree Component ---
function FileTree({ workspacePath, onFileSelect, onRefresh, activeFile }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (workspacePath) {
      invoke("read_workspace_files", { workspacePath })
        .then(setFiles)
        .catch(err => {
          console.error("Failed to read workspace files:", err);
          setError("Could not read workspace files.");
        });
    }
  }, [workspacePath, onRefresh]);

  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;

  return (
    <ul className="space-y-1">
      {files.map((entry) => (
        <li key={entry.path}>
          <button 
            onClick={() => onFileSelect(entry)}
            className={`w-full text-left px-2 py-1 text-sm rounded flex items-center gap-2 transition-colors ${activeFile === entry.path ? 'bg-app-accent/20 text-app-text' : 'text-app-muted hover:text-app-text hover:bg-app-bg'}`}
          >
            {entry.is_directory ? <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" className="w-4 h-4" /> : <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="w-4 h-4" />}
            <span>{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// --- Main Workspace Component ---
export default function Workspace({ initialPath = "" }) {
  const [path, setPath] = useState(initialPath);
  const { leftW, rightW, startLeftDrag, startRightDrag } = useDragColumns({});
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [refreshId, setRefreshId] = useState(0);

  const [activeFile, setActiveFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const editorContentRef = useRef(null);

  useEffect(() => {
    if (path) loadThemeForWorkspace(path);
    const sub = listen("workspace:activate", (e) => setPath(String(e.payload || "")));
    return () => { sub.then((un) => un()); };
  }, [path]);

  const handleRefreshFiles = () => setRefreshId(id => id + 1);

  const handleFileSelect = async (file) => {
    if (file.is_directory) return;
    try {
      const content = await invoke("read_file_content", { path: file.path });
      setActiveFile(file.path);
      setEditorContent(content);
      setEditorTitle(file.name.replace(/\.md$/, ""));
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  };

  const handleSaveFile = async () => {
    if (!activeFile) return;
    const newContent = editorContentRef.current?.innerText || "";
    try {
      await invoke("write_file_content", { path: activeFile, content: newContent });
      // Maybe add a small "Saved!" notification here in the future
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  };

  const handleTitleChange = async (newTitle) => {
    if (!activeFile || !newTitle || newTitle === editorTitle) return;
    
    const newFileName = `${newTitle}.md`;
    try {
      const newPath = await invoke("rename_file", { path: activeFile, newName: newFileName });
      setActiveFile(newPath);
      setEditorTitle(newTitle);
      handleRefreshFiles();
    } catch (error) {
      console.error("Failed to rename file:", error);
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

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:", "new-folder");
    if (name) {
      await invoke("create_folder_in_workspace", { workspacePath: path, name });
      handleRefreshFiles();
    }
  };

  // Keyboard shortcut listener for Save (Cmd/Ctrl+S)
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeFile]); // Re-bind if activeFile changes

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
              <FileTree workspacePath={path} onRefresh={refreshId} onFileSelect={handleFileSelect} activeFile={activeFile} />
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
                    onBlur={(e) => handleTitleChange(e.target.value)}
                    className="w-full bg-transparent text-4xl font-bold mb-6 outline-none text-app-text"
                  />
                  <div 
                    ref={editorContentRef}
                    className="min-h-full leading-relaxed outline-none whitespace-pre-wrap text-base" 
                    contentEditable 
                    dangerouslySetInnerHTML={{ __html: editorContent }}
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
