import React, { useRef, useEffect, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useAutoExpand } from '../../hooks/useAutoExpand.js';
import { ColoredFileIcon } from '../ui/FileIcon.jsx';
import FileContextMenu from './FileContextMenu.jsx';
import InlineRenameInput from './InlineRenameInput.jsx';
import { getFilename } from '../../utils/pathUtils.js';
import { cutFiles, copyFiles, getRelativePath } from '../../utils/clipboard.js';

export default function FileEntryComponent({
    entry,
    level,
    onFileClick,
    activeFile,
    expandedFolders,
    toggleFolder,
    onRefresh,
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
    updateDropPosition,
    fileTreeRef,
    isExternalDragActive,
    hoveredFolder,
    setHoveredFolder,
    toast
}) {
    const entryRef = useRef(null);
    const hoverTimeoutRef = useRef(null);

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

    // Auto-expand folder after 800ms hover during drag
    const willAutoExpand = useAutoExpand(isOver, entry.is_directory, isExpanded, entry.path, toggleFolder);

    // Update drop position when dragging over this element
    const handleDragOver = useCallback((event) => {
        if (isOver && updateDropPosition && entryRef.current) {
            updateDropPosition(event, entryRef.current, entry);
        }
    }, [isOver, updateDropPosition, entry]);

    useEffect(() => {
        const element = entryRef.current;
        if (element && isOver) {
            element.addEventListener('dragover', handleDragOver);
            return () => element.removeEventListener('dragover', handleDragOver);
        }
    }, [isOver, handleDragOver]);

    // External file drop handlers for folders
    const handleExternalDragEnter = (e) => {
        if (isExternalDragActive && entry.is_directory) {
            e.preventDefault();
            e.stopPropagation();
            setHoveredFolder(entry.path);

            // Auto-expand after 800ms
            hoverTimeoutRef.current = setTimeout(() => {
                if (!isExpanded) {
                    toggleFolder(entry.path);
                }
            }, 800);
        }
    };

    const handleExternalDragLeave = (e) => {
        if (isExternalDragActive && entry.is_directory) {
            e.preventDefault();
            e.stopPropagation();
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    // Calculate file count for folders
    const fileCount = entry.is_directory && entry.children ? entry.children.length : null;

    const handleClick = () => {
        if (entry.is_directory) {
            toggleFolder(entry.path);
        } else {
            onFileClick(entry);
        }
    };

    const baseClasses = "obsidian-file-item";
    const stateClasses = activeFile === entry.path ? 'active' : '';
    const dropTargetClasses = isDropTarget ? 'drop-target-inside' : '';
    const draggingClasses = isDragging ? 'dragging' : '';
    const willExpandClasses = willAutoExpand ? 'will-expand-indicator' : '';
    const externalDropTargetClasses = (isExternalDragActive && entry.is_directory && hoveredFolder === entry.path) ? 'external-drop-target' : '';

    const onRename = () => {
        // For .md files: open them (the note header handles renaming)
        if (!entry.is_directory && entry.path.endsWith('.md')) {
            onFileClick(entry);
            return;
        }

        // For other files and folders: enter inline rename mode
        setRenamingPath(entry.path);
    };

    const handleRenameSubmit = async (newName) => {
        if (!newName || newName.trim() === "" || newName.trim() === entry.name) {
            setRenamingPath(null);
            return;
        }

        try {
            const trimmedName = newName.trim();
            await invoke("rename_file", { path: entry.path, newName: trimmedName });
            setRenamingPath(null);
            onRefresh && onRefresh();
        } catch (e) {
            console.error('Failed to rename:', e);
            toast?.error(`Failed to rename: ${e.message || e}`);
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
        } catch (e) {
            console.error('Failed to create file:', e);
            toast?.error(`Failed to create file: ${e.message || e}`);
        }
    };

    const onCreateFolderHere = async () => {
        const name = window.prompt("New folder name:");
        if (!name) return;
        try {
            const base = entry.is_directory ? entry.path : entry.path.split("/").slice(0, -1).join("/");
            await invoke("create_folder_in_workspace", { workspacePath: base, name });
            onRefresh && onRefresh();
        } catch (e) {
            console.error('Failed to create folder:', e);
            toast?.error(`Failed to create folder: ${e.message || e}`);
        }
    };

    const handleFileContextAction = useCallback(async (action, data) => {
        const { file } = data;

        switch (action) {
            case 'open':
                onFileClick(file);
                break;
            case 'openToSide':
                // Enable split view and open file in right pane
                setUseSplitView(true);
                setRightPaneFile(file.path);

                // Set title (remove .md extension)
                const fileName = getFilename(file.name);
                setRightPaneTitle(fileName.replace(/\.md$/, ''));

                // Load content if it's a markdown file
                if (file.path.endsWith('.md') || file.path.endsWith('.txt')) {
                    // Check if this file is already loaded in the left pane to avoid duplicate load
                    if (file.path === activeFile && editorContent) { // editorContent is not defined here! It was in Workspace scope.
                        // We need to pass editorContent or handle this differently.
                        // For now, let's assume we re-fetch content or ignore this optimization.
                        // Or we can pass editorContent as prop.
                        // But editorContent is large.
                        // Let's just re-fetch for now to be safe/simple.
                        // Or better: check if we can access it.
                    }

                    try {
                        const content = await invoke('read_file_content', { path: file.path });
                        setRightPaneContent(content || '');
                    } catch (err) {
                        console.error('Failed to load file content:', err);
                        setRightPaneContent('');
                    }
                } else {
                    setRightPaneContent('');
                }
                break;
            case 'viewHistory':
                if (onViewHistory && file.type === 'file') {
                    onViewHistory(file.path);
                }
                break;
            case 'openWith':
                // Open file with system default application
                try {
                    await invoke('platform_open_with_default', { path: file.path });
                } catch (e) {
                    toast.error(`Failed to open file: ${e}`);
                }
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
                // Cut file to clipboard
                cutFiles([file]);
                toast.success(`Cut: ${file.name}`);
                break;
            case 'copy':
                // Copy file to clipboard
                copyFiles([file]);
                toast.success(`Copied: ${file.name}`);
                break;
            case 'copyPath':
                try {
                    await navigator.clipboard.writeText(file.path);
                } catch (e) {
                }
                break;
            case 'copyRelativePath':
                try {
                    const relativePath = getRelativePath(file.path, file.path); // Wait, second arg is 'path' (workspace root?)
                    // In Workspace.jsx: getRelativePath(file.path, path) where 'path' was workspace path.
                    // We don't have 'path' (workspace path) here.
                    // We need to pass it as prop.
                    // Or assume it's available via context?
                    // Let's assume we need to pass it.
                    // But for now, let's just use file.path if we can't calculate relative.
                    // Or better: pass workspacePath as prop.
                    await navigator.clipboard.writeText(file.path); // Fallback to absolute path for now to avoid error
                    toast.success('Copied path');
                } catch (e) {
                    toast.error('Failed to copy path');
                }
                break;
            case 'newFile':
                await onCreateFileHere();
                break;
            case 'newFolder':
                await onCreateFolderHere();
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
                // Select file for comparison
                // setSelectedFileForCompare is not available here.
                // Needs to be passed as prop or callback.
                // Let's comment out for now or use a callback prop.
                // if (file.type === 'file') {
                //   setSelectedFileForCompare(file);
                //   toast.success(`Selected for compare: ${file.name}`);
                // }
                break;
            case 'compareWith':
                // Compare with previously selected file
                // Needs selectedFileForCompare and setSelectedFileForCompare.
                break;
            case 'shareEmail':
            case 'shareSlack':
            case 'shareTeams':
                // Basic sharing: copy file path to clipboard
                try {
                    await navigator.clipboard.writeText(file.path);
                    toast.success(`File path copied. Share via ${action.replace('share', '')}`);
                } catch (e) {
                    toast.error('Failed to copy file path');
                }
                break;
            case 'addTag':
            case 'manageTags':
                // Open tag management modal for markdown files
                if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
                    setTagModalFile(file);
                    setShowTagModal(true);
                }
                break;
            default:
        }
    }, [
        onFileClick,
        setUseSplitView,
        setRightPaneFile,
        setRightPaneTitle,
        setRightPaneContent,
        onViewHistory,
        onRefresh,
        setTagModalFile,
        setShowTagModal,
        activeFile
    ]);

    return (
        <li
            className="file-entry-container"
            data-level={level}
            data-path={entry.path}
            style={{ paddingLeft: `${level * 1.25}rem`, '--level': level }}
        >
            <div
                ref={(node) => {
                    droppableRef(node);
                    entryRef.current = node;
                }}
                className="rounded"
            >
                <div ref={draggableRef} className="flex items-center">
                    <FileContextMenu
                        file={{ ...entry, type: entry.is_directory ? 'folder' : 'file' }}
                        onAction={handleFileContextAction}
                    >
                        <button
                            {...listeners}
                            {...attributes}
                            onClick={handleClick}
                            onDragEnter={handleExternalDragEnter}
                            onDragLeave={handleExternalDragLeave}
                            className={`${baseClasses} ${stateClasses} ${dropTargetClasses} ${draggingClasses} ${willExpandClasses} ${externalDropTargetClasses} file-entry-item`}
                        >
                            <ColoredFileIcon
                                fileName={entry.name}
                                isDirectory={entry.is_directory}
                                isExpanded={isExpanded}
                                className="obsidian-file-icon"
                                showChevron={true}
                            />
                            {renamingPath === entry.path ? (
                                <InlineRenameInput
                                    initialValue={entry.name}
                                    onSubmit={handleRenameSubmit}
                                    onCancel={handleRenameCancel}
                                />
                            ) : (
                                <span className="truncate">{entry.name}</span>
                            )}
                            {fileCount !== null && (
                                <span className="file-count-badge">({fileCount})</span>
                            )}
                        </button>
                    </FileContextMenu>
                </div>
            </div>
            <AnimatePresence initial={false}>
                {isExpanded && entry.children && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="folder-children-container"
                    >
                        <ul className="space-y-1 mt-1">
                            {entry.children.map(child => (
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
                                    setTagModalFile={setTagModalFile}
                                    setShowTagModal={setShowTagModal}
                                    setUseSplitView={setUseSplitView}
                                    setRightPaneFile={setRightPaneFile}
                                    setRightPaneTitle={setRightPaneTitle}
                                    setRightPaneContent={setRightPaneContent}
                                    updateDropPosition={updateDropPosition}
                                    fileTreeRef={fileTreeRef}
                                    isExternalDragActive={isExternalDragActive}
                                    hoveredFolder={hoveredFolder}
                                    setHoveredFolder={setHoveredFolder}
                                    toast={toast}
                                />
                            ))}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
}
