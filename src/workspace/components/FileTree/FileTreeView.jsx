/**
 * File Tree View Component
 * Main container for the file tree with drag-and-drop support
 */
import { DndContext, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { invoke } from "@tauri-apps/api/core";
import FileEntryComponent from "./FileEntry.jsx";
import NewFolderInput from "./NewFolderInput.jsx";

function FileTreeView({ entries, onFileClick, activeFile, onRefresh, expandedFolders, toggleFolder, isCreating, onCreateConfirm, keymap, renamingPath, setRenamingPath, onViewHistory }) {
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
            renamingPath={renamingPath}
            setRenamingPath={setRenamingPath}
            onViewHistory={onViewHistory}
          />
        ))}
      </ul>
    </DndContext>
  );
}

export default FileTreeView;
