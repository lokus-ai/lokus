import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { canvasManager } from '../../core/canvas/manager.js';
import { getFilename } from '../../utils/pathUtils.js';

const MAX_OPEN_TABS = 10;

/**
 * Custom hook for file operations in the workspace
 *
 * Provides handlers for common file operations including:
 * - Opening files and creating tabs
 * - Creating new files, folders, canvas, and kanban boards
 * - Renaming files and folders
 * - Deleting files and folders
 * - Refreshing the file tree
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.workspacePath - Current workspace path
 * @param {Array} params.openTabs - Array of currently open tabs
 * @param {Function} params.setOpenTabs - Setter for open tabs
 * @param {string} params.activeFile - Currently active file path
 * @param {Function} params.setActiveFile - Setter for active file
 * @param {Function} params.setRefreshId - Setter to trigger file tree refresh
 * @param {Function} params.setIsCreatingFolder - Setter for folder creation mode
 * @returns {Object} Object containing file operation handlers
 */
export function useFileOperations({
  workspacePath,
  openTabs,
  setOpenTabs,
  activeFile,
  setActiveFile,
  setRefreshId,
  setIsCreatingFolder
}) {
  /**
   * Refreshes the file tree by incrementing the refresh ID
   */
  const handleRefreshFiles = useCallback(() => {
    setRefreshId(id => id + 1);
  }, [setRefreshId]);

  /**
   * Opens a file in a new or existing tab
   * Supports regular files and search results with line numbers
   *
   * @param {Object} file - File object to open
   * @param {string} file.path - File path
   * @param {string} file.name - File name
   * @param {boolean} file.is_directory - Whether the file is a directory
   * @param {number} [file.lineNumber] - Optional line number for search results
   * @param {number} [file.column] - Optional column number for search results
   */
  const handleFileClick = useCallback((file) => {
    // Handle search result format with line numbers
    if (file.path && file.lineNumber !== undefined) {
      const filePath = file.path;
      const fileName = getFilename(filePath);

      setOpenTabs(prevTabs => {
        const newTabs = prevTabs.filter(t => t.path !== filePath);
        newTabs.unshift({ path: filePath, name: fileName });
        if (newTabs.length > MAX_OPEN_TABS) {
          newTabs.pop();
        }
        return newTabs;
      });
      setActiveFile(filePath);

      // Note: Line jumping is handled externally via editorRef
      return;
    }

    // Handle regular file format
    if (file.is_directory) return;

    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(t => t.path !== file.path);
      const fileName = getFilename(file.name);
      newTabs.unshift({ path: file.path, name: fileName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return newTabs;
    });
    setActiveFile(file.path);
  }, [setOpenTabs, setActiveFile]);

  /**
   * Creates a new markdown file in the workspace
   * Opens the new file in a tab after creation
   */
  const handleCreateFile = useCallback(async () => {
    try {
      const newFilePath = await invoke('create_file_in_workspace', {
        workspacePath,
        name: 'Untitled.md'
      });
      handleRefreshFiles();
      handleFileClick({
        path: newFilePath,
        name: 'Untitled.md',
        is_directory: false
      });
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  }, [workspacePath, handleRefreshFiles, handleFileClick]);

  /**
   * Creates a new canvas file in the workspace
   * Opens the new canvas in a tab after creation
   */
  const handleCreateCanvas = useCallback(async () => {
    try {
      const newCanvasPath = await canvasManager.createCanvas(workspacePath, 'Untitled Canvas');
      handleRefreshFiles();
      handleFileClick({
        path: newCanvasPath,
        name: 'Untitled Canvas.canvas',
        is_directory: false
      });
    } catch (error) {
      console.error('Failed to create canvas:', error);
    }
  }, [workspacePath, handleRefreshFiles, handleFileClick]);

  /**
   * Creates a new kanban board in the workspace
   * Opens the new board in a tab after creation
   */
  const handleCreateKanban = useCallback(async () => {
    try {
      const board = await invoke('create_kanban_board', {
        workspacePath,
        name: 'New Board',
        columns: ['To Do', 'In Progress', 'Done']
      });
      handleRefreshFiles();
      const fileName = 'New Board.kanban';
      const boardPath = `${workspacePath}/${fileName}`;
      handleFileClick({
        path: boardPath,
        name: fileName,
        is_directory: false
      });
    } catch (error) {
      console.error('Failed to create kanban board:', error);
    }
  }, [workspacePath, handleRefreshFiles, handleFileClick]);

  /**
   * Initiates folder creation mode
   * Actual creation is handled by handleConfirmCreateFolder
   */
  const handleCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
  }, [setIsCreatingFolder]);

  /**
   * Confirms and creates a new folder in the workspace
   *
   * @param {string} name - Name of the folder to create
   */
  const handleConfirmCreateFolder = useCallback(async (name) => {
    if (name) {
      try {
        await invoke('create_folder_in_workspace', {
          workspacePath,
          name
        });
        handleRefreshFiles();
      } catch (error) {
        console.error('Failed to create folder:', error);
      }
    }
    setIsCreatingFolder(false);
  }, [workspacePath, handleRefreshFiles, setIsCreatingFolder]);

  /**
   * Renames a file or folder
   *
   * @param {string} path - Path of the file/folder to rename
   * @param {string} newName - New name for the file/folder
   * @param {Function} [onSuccess] - Optional callback on successful rename
   * @param {Function} [onError] - Optional callback on error
   */
  const handleRename = useCallback(async (path, newName, onSuccess, onError) => {
    if (!newName || newName.trim() === '') {
      if (onError) onError('Name cannot be empty');
      return;
    }

    try {
      const trimmedName = newName.trim();
      await invoke('rename_file', { path, newName: trimmedName });
      handleRefreshFiles();

      // Update tab name if the renamed file is open
      setOpenTabs(prevTabs =>
        prevTabs.map(tab => {
          if (tab.path === path) {
            const newPath = path.split('/').slice(0, -1).concat(trimmedName).join('/');
            return { ...tab, path: newPath, name: getFilename(trimmedName) };
          }
          return tab;
        })
      );

      // Update active file if it was renamed
      if (activeFile === path) {
        const newPath = path.split('/').slice(0, -1).concat(trimmedName).join('/');
        setActiveFile(newPath);
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Failed to rename:', error);
      if (onError) onError(error.message || 'Failed to rename');
    }
  }, [handleRefreshFiles, setOpenTabs, activeFile, setActiveFile]);

  /**
   * Deletes a file or folder after confirmation
   *
   * @param {string} path - Path of the file/folder to delete
   * @param {string} name - Name of the file/folder (for confirmation dialog)
   * @param {Function} [onSuccess] - Optional callback on successful deletion
   * @param {Function} [onError] - Optional callback on error
   */
  const handleDelete = useCallback(async (path, name, onSuccess, onError) => {
    try {
      const confirmed = await confirm(
        `Are you sure you want to delete "${name}"?`,
        {
          title: 'Delete File',
          type: 'warning'
        }
      );

      if (confirmed) {
        await invoke('delete_file', { path });
        handleRefreshFiles();

        // Close tab if the deleted file was open
        setOpenTabs(prevTabs => {
          const newTabs = prevTabs.filter(tab => tab.path !== path);

          // If the active file was deleted, switch to another tab or clear
          if (activeFile === path) {
            if (newTabs.length > 0) {
              setActiveFile(newTabs[0].path);
            } else {
              setActiveFile(null);
            }
          }

          return newTabs;
        });

        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      if (onError) onError(error.message || 'Failed to delete');
    }
  }, [handleRefreshFiles, setOpenTabs, activeFile, setActiveFile]);

  return {
    handleFileClick,
    handleRefreshFiles,
    handleCreateFile,
    handleCreateCanvas,
    handleCreateKanban,
    handleCreateFolder,
    handleConfirmCreateFolder,
    handleRename,
    handleDelete
  };
}
