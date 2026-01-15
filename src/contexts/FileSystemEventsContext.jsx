import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { fileSystemEvents } from '../core/fs/FileSystemEvents';

/**
 * Context for file system events
 * Provides access to the file system event emitter and utility functions
 */
const FileSystemEventsContext = createContext(null);

/**
 * Provider component for file system events
 * Wraps children with access to file system event utilities
 */
export function FileSystemEventsProvider({ children }) {
  const value = {
    /**
     * Emit a file deleted event
     * @param {string} path - Path of deleted file/folder
     */
    emitFileDeleted: useCallback((path) => {
      fileSystemEvents.emitFileDeleted(path);
    }, []),

    /**
     * Emit a file renamed event
     * @param {string} oldPath - Previous path
     * @param {string} newPath - New path
     */
    emitFileRenamed: useCallback((oldPath, newPath) => {
      fileSystemEvents.emitFileRenamed(oldPath, newPath);
    }, []),

    /**
     * Emit a file moved event
     * @param {string} oldPath - Previous path
     * @param {string} newPath - New path
     */
    emitFileMoved: useCallback((oldPath, newPath) => {
      fileSystemEvents.emitFileMoved(oldPath, newPath);
    }, []),

    /**
     * Check if a path is affected by an operation
     */
    isPathAffected: fileSystemEvents.isPathAffected.bind(fileSystemEvents),

    /**
     * Get updated path after rename/move
     */
    getUpdatedPath: fileSystemEvents.getUpdatedPath.bind(fileSystemEvents),
  };

  return (
    <FileSystemEventsContext.Provider value={value}>
      {children}
    </FileSystemEventsContext.Provider>
  );
}

/**
 * Hook to access file system event emitters
 * @returns {Object} File system event emitters and utilities
 */
export function useFileSystemEvents() {
  const context = useContext(FileSystemEventsContext);
  if (!context) {
    throw new Error('useFileSystemEvents must be used within a FileSystemEventsProvider');
  }
  return context;
}

/**
 * Hook to subscribe to file deletion events
 * @param {Function} callback - Called with { path } when a file is deleted
 */
export function useOnFileDeleted(callback) {
  useEffect(() => {
    const unsubscribe = fileSystemEvents.on('file:deleted', callback);
    return unsubscribe;
  }, [callback]);
}

/**
 * Hook to subscribe to file rename events
 * @param {Function} callback - Called with { oldPath, newPath } when a file is renamed
 */
export function useOnFileRenamed(callback) {
  useEffect(() => {
    const unsubscribe = fileSystemEvents.on('file:renamed', callback);
    return unsubscribe;
  }, [callback]);
}

/**
 * Hook to subscribe to file move events
 * @param {Function} callback - Called with { oldPath, newPath } when a file is moved
 */
export function useOnFileMoved(callback) {
  useEffect(() => {
    const unsubscribe = fileSystemEvents.on('file:moved', callback);
    return unsubscribe;
  }, [callback]);
}

/**
 * Hook to subscribe to all file change events (delete, rename, move)
 * @param {Object} callbacks - Object with onDeleted, onRenamed, onMoved callbacks
 */
export function useFileChangeEvents({ onDeleted, onRenamed, onMoved }) {
  useEffect(() => {
    const unsubscribes = [];

    if (onDeleted) {
      unsubscribes.push(fileSystemEvents.on('file:deleted', onDeleted));
    }
    if (onRenamed) {
      unsubscribes.push(fileSystemEvents.on('file:renamed', onRenamed));
    }
    if (onMoved) {
      unsubscribes.push(fileSystemEvents.on('file:moved', onMoved));
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [onDeleted, onRenamed, onMoved]);
}

export default FileSystemEventsContext;
