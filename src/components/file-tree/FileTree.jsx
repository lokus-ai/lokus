import React, { useState, useRef } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { invoke } from '@tauri-apps/api/core';
import { useDropPosition } from '../../hooks/useDropPosition.js';
import NewFolderInput from './NewFolderInput.jsx';
import FileEntryComponent from './FileEntry.jsx';
import DropIndicator from './FileTree/DropIndicator.jsx';
import { ColoredFileIcon } from '../ui/FileIcon.jsx';

export default function FileTree({
    entries,
    onFileClick,
    activeFile,
    onRefresh,
    expandedFolders,
    toggleFolder,
    isCreating,
    onCreateConfirm,
    keymap,
    renamingPath,
    setRenamingPath,
    onViewHistory,
    setTagModalFile,
    setShowTagModal,
    setUseSplitView,
    setRightPaneFile,
    setRightPaneTitle,
    setRightPaneContent,
    isExternalDragActive,
    hoveredFolder,
    setHoveredFolder,
    toast
}) {
    const [activeEntry, setActiveEntry] = useState(null);
    const fileTreeRef = useRef(null);
    const { dropPosition, updatePosition, clearPosition } = useDropPosition();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10,
            },
        })
    );

    const handleDragStart = (event) => {
        const sourceEntry = event.active.data.current?.entry;
        setActiveEntry(sourceEntry);
    };

    const handleDragEnd = async (event) => {
        const { over, active } = event;
        setActiveEntry(null);
        clearPosition();

        if (!over || !active) return;

        const sourceEntry = active.data.current?.entry;
        const targetEntry = over.data.current?.entry;

        if (!sourceEntry || !targetEntry || sourceEntry.path === targetEntry.path) {
            return;
        }

        try {
            // Use dropPosition if available for precise placement
            if (dropPosition) {
                const { position, targetPath } = dropPosition;

                if (position === "inside") {
                    // Drop inside folder
                    await invoke("move_file", {
                        sourcePath: sourceEntry.path,
                        destinationDir: targetPath,
                    });
                } else {
                    // For "before" and "after", move to same parent as target
                    const targetParent = targetPath.substring(0, targetPath.lastIndexOf('/'));
                    await invoke("move_file", {
                        sourcePath: sourceEntry.path,
                        destinationDir: targetParent || targetEntry.path.substring(0, targetEntry.path.lastIndexOf('/')),
                    });
                }
            } else if (targetEntry.is_directory) {
                // Fallback to old behavior (drop inside folder)
                await invoke("move_file", {
                    sourcePath: sourceEntry.path,
                    destinationDir: targetEntry.path,
                });
            }

            onRefresh();
        } catch (error) {
            console.error("Failed to move file:", error);
        }
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div ref={fileTreeRef} className="file-tree-container">
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
                            setTagModalFile={setTagModalFile}
                            setShowTagModal={setShowTagModal}
                            setUseSplitView={setUseSplitView}
                            setRightPaneFile={setRightPaneFile}
                            setRightPaneTitle={setRightPaneTitle}
                            setRightPaneContent={setRightPaneContent}
                            updateDropPosition={updatePosition}
                            fileTreeRef={fileTreeRef}
                            isExternalDragActive={isExternalDragActive}
                            hoveredFolder={hoveredFolder}
                            setHoveredFolder={setHoveredFolder}
                            toast={toast}
                        />
                    ))}
                </ul>

                {/* Drop position indicator */}
                <DropIndicator
                    position={dropPosition}
                    targetPath={dropPosition?.targetPath}
                    fileTreeRef={fileTreeRef}
                />
            </div>

            {/* Drag overlay with ghost preview */}
            <DragOverlay>
                {activeEntry ? (
                    <div className="drag-preview">
                        <ColoredFileIcon
                            filename={activeEntry.name}
                            isDirectory={activeEntry.is_directory}
                            size={16}
                        />
                        <span>{activeEntry.name}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
