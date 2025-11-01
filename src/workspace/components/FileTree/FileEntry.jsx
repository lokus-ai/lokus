/**
 * File Entry Component
 * Represents a single file or folder in the file tree with drag-drop support
 */
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import Icon from "../Icon.jsx";
import FileContextMenu from "../../../components/FileContextMenu.jsx";
import InlineRenameInput from "./InlineRenameInput.jsx";

function FileEntryComponent({ entry, level, onFileClick, activeFile, expandedFolders, toggleFolder, onRefresh, keymap, renamingPath, setRenamingPath, onViewHistory }) {
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

  const onRename = () => {
    // For files: just open them (the note header handles renaming)
    if (!entry.is_directory) {
      onFileClick(entry);
      return;
    }

    // For folders: enter inline rename mode
    setRenamingPath(entry.path);
  };

  const handleRenameSubmit = async (newName) => {
    if (!newName || newName.trim() === "" || newName.trim() === entry.name) {
      setRenamingPath(null);
      return;
    }

    try {
      const trimmedName = newName.trim();
      console.log(`Renaming "${entry.name}" to "${trimmedName}"`);
      await invoke("rename_file", { path: entry.path, newName: trimmedName });
      console.log('Rename successful, refreshing file list');
      setRenamingPath(null);
      onRefresh && onRefresh();
    } catch (e) {
      console.error('Failed to rename:', e);
      alert(`Failed to rename: ${e.message || e}`);
      setRenamingPath(null);
    }
  };

  const handleRenameCancel = () => {
    setRenamingPath(null);
  };

  const onCreateFileHere = async () => {
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      const name = "Untitled.md";
      await invoke("write_file_content", { path: `${base}/${name}`, content: "" });
      onRefresh && onRefresh();
    } catch (e) { }
  };

  const onCreateFolderHere = async () => {
    const name = window.prompt("New folder name:");
    if (!name) return;
    try {
      const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
      await invoke("create_folder_in_workspace", { workspacePath: base, name });
      onRefresh && onRefresh();
    } catch (e) { }
  };

  const handleFileContextAction = async (action, data) => {
    const { file } = data;

    switch (action) {
      case 'open':
        onFileClick(file);
        break;
      case 'openToSide':
        // TODO: Implement open to side functionality
        break;
      case 'viewHistory':
        if (onViewHistory && file.type === 'file') {
          onViewHistory(file.path);
        }
        break;
      case 'openWith':
        // TODO: Implement open with functionality
        break;
      case 'revealInFinder':
        try {
          await invoke('platform_reveal_in_file_manager', { path: file.path });
        } catch (e) {
          console.error('Failed to reveal in file manager:', e);
        }
        break;
      case 'openInTerminal':
        try {
          const terminalPath = file.is_directory ? file.path : file.path.split("/").slice(0, -1).join("/");
          await invoke('platform_open_terminal', { path: terminalPath });
        } catch (e) {
          console.error('Failed to open terminal:', e);
        }
        break;
      case 'cut':
        // TODO: Implement cut functionality
        break;
      case 'copy':
        // TODO: Implement copy functionality
        break;
      case 'copyPath':
        try {
          await navigator.clipboard.writeText(file.path);
        } catch (e) {
        }
        break;
      case 'copyRelativePath':
        try {
          // TODO: Calculate relative path from workspace root
          const relativePath = file.path; // Simplified for now
          await navigator.clipboard.writeText(relativePath);
        } catch (e) {
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
        }
        break;
      case 'selectForCompare':
        // TODO: Implement select for compare
        break;
      case 'shareEmail':
      case 'shareSlack':
      case 'shareTeams':
        // TODO: Implement sharing functionality
        break;
      default:
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
              {renamingPath === entry.path && entry.is_directory ? (
                <InlineRenameInput
                  initialValue={entry.name}
                  onSubmit={handleRenameSubmit}
                  onCancel={handleRenameCancel}
                />
              ) : (
                <span className="truncate">{entry.name}</span>
              )}
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
              renamingPath={renamingPath}
              setRenamingPath={setRenamingPath}
              onViewHistory={onViewHistory}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default FileEntryComponent;
