import { EventEmitter } from '../../utils/EventEmitter';

/**
 * FileSystemEventEmitter - Centralized event system for file system changes
 *
 * Emits events when files are deleted, renamed, or moved so that
 * connected components (tabs, breadcrumbs, etc.) can react accordingly.
 *
 * Events:
 * - file:deleted { path: string } - When a file/folder is deleted
 * - file:renamed { oldPath: string, newPath: string } - When a file/folder is renamed
 * - file:moved { oldPath: string, newPath: string } - When a file/folder is moved
 */
class FileSystemEventEmitter extends EventEmitter {
  /**
   * Emit when a file or folder is deleted
   * @param {string} path - The path of the deleted file/folder
   */
  emitFileDeleted(path) {
    this.emit('file:deleted', { path });
  }

  /**
   * Emit when a file or folder is renamed
   * @param {string} oldPath - The previous path
   * @param {string} newPath - The new path after rename
   */
  emitFileRenamed(oldPath, newPath) {
    this.emit('file:renamed', { oldPath, newPath });
  }

  /**
   * Emit when a file or folder is moved
   * @param {string} oldPath - The previous path
   * @param {string} newPath - The new path after move
   */
  emitFileMoved(oldPath, newPath) {
    this.emit('file:moved', { oldPath, newPath });
  }

  /**
   * Check if a path is affected by a file operation
   * Used by consumers to determine if they need to update
   * @param {string} targetPath - Path being checked
   * @param {string} operationPath - Path where operation occurred
   * @returns {boolean} - True if targetPath is the same as or inside operationPath
   */
  isPathAffected(targetPath, operationPath) {
    return targetPath === operationPath || targetPath.startsWith(operationPath + '/');
  }

  /**
   * Get updated path after a rename/move operation
   * @param {string} targetPath - The path to update
   * @param {string} oldPath - The old base path
   * @param {string} newPath - The new base path
   * @returns {string} - The updated path
   */
  getUpdatedPath(targetPath, oldPath, newPath) {
    if (targetPath === oldPath) {
      return newPath;
    }
    if (targetPath.startsWith(oldPath + '/')) {
      return newPath + targetPath.slice(oldPath.length);
    }
    return targetPath;
  }
}

// Singleton instance for global access
export const fileSystemEvents = new FileSystemEventEmitter();

export default FileSystemEventEmitter;
