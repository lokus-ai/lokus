import React from 'react';
import {
  FileText,
  File,
  Code,
  FileJson,
  Image,
  FileCode,
  FileType,
  Braces,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Database,
  Settings,
  FileImage,
  Film,
  FileArchive,
  Package,
  Layout,
  Trello,
  FileSpreadsheet,
  Table,
  FileCheck,
  Calendar,
  TrendingUp,
} from 'lucide-react';

/**
 * File Type Icon Component
 *
 * Renders appropriate icons for different file types based on extension
 * Supports folder states (open/closed) and various file types
 */

const FILE_ICON_MAP = {
  // Markdown & Text
  'md': FileText,
  'markdown': FileText,
  'txt': FileType,
  'rtf': FileType,

  // Code Files - JavaScript/TypeScript
  'js': FileCode,
  'jsx': FileCode,
  'ts': FileCode,
  'tsx': FileCode,
  'mjs': FileCode,
  'cjs': FileCode,

  // Code Files - Web
  'html': Code,
  'htm': Code,
  'css': Code,
  'scss': Code,
  'sass': Code,
  'less': Code,

  // Code Files - Other Languages
  'py': FileCode,
  'rb': FileCode,
  'java': FileCode,
  'c': FileCode,
  'cpp': FileCode,
  'h': FileCode,
  'hpp': FileCode,
  'rs': FileCode,
  'go': FileCode,
  'php': FileCode,
  'swift': FileCode,
  'kt': FileCode,
  'scala': FileCode,
  'r': FileCode,
  'sh': FileCode,
  'bash': FileCode,
  'zsh': FileCode,

  // Data & Config
  'json': FileJson,
  'yaml': Settings,
  'yml': Settings,
  'toml': Settings,
  'ini': Settings,
  'conf': Settings,
  'config': Settings,
  'xml': Braces,
  'csv': FileSpreadsheet,

  // Database
  'sql': Database,
  'db': Database,
  'sqlite': Database,
  'sqlite3': Database,

  // Images
  'png': FileImage,
  'jpg': FileImage,
  'jpeg': FileImage,
  'gif': FileImage,
  'svg': FileImage,
  'webp': FileImage,
  'ico': FileImage,
  'bmp': FileImage,

  // Video & Audio
  'mp4': Film,
  'avi': Film,
  'mov': Film,
  'wmv': Film,
  'flv': Film,
  'webm': Film,
  'mp3': Film,
  'wav': Film,
  'ogg': Film,

  // Archives
  'zip': FileArchive,
  'tar': FileArchive,
  'gz': FileArchive,
  'rar': FileArchive,
  '7z': FileArchive,
  'bz2': FileArchive,

  // Special Lokus Files
  'excalidraw': Layout,
  'canvas': Layout,  // deprecated: use .excalidraw
  'kanban': Trello,
  'graph': TrendingUp,

  // Other
  'pdf': File,
  'doc': FileText,
  'docx': FileText,
  'xls': FileSpreadsheet,
  'xlsx': FileSpreadsheet,
  'ppt': FileText,
  'pptx': FileText,
  'lock': FileCheck,
  'log': FileText,
};

/**
 * Get the appropriate icon component for a file based on its extension
 */
function getFileIcon(fileName) {
  if (!fileName) return File;

  const extension = fileName.split('.').pop()?.toLowerCase();
  return FILE_ICON_MAP[extension] || File;
}

/**
 * FileIcon Component
 *
 * @param {Object} props
 * @param {string} props.fileName - Name of the file
 * @param {boolean} props.isDirectory - Whether this is a directory
 * @param {boolean} props.isExpanded - Whether the directory is expanded (only for directories)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showChevron - Whether to show chevron for folders (default: true)
 */
export default function FileIcon({
  fileName,
  isDirectory,
  isExpanded,
  className = "w-4 h-4",
  showChevron = true
}) {
  // Handle folders
  if (isDirectory) {
    if (showChevron) {
      // Show chevron for expandable folders
      const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
      return <ChevronIcon className={className} />;
    } else {
      // Show folder icon
      const FolderIcon = isExpanded ? FolderOpen : Folder;
      return <FolderIcon className={className} />;
    }
  }

  // Handle files
  const IconComponent = getFileIcon(fileName);
  return <IconComponent className={className} />;
}

/**
 * Get file icon color based on file type
 * Returns Tailwind color classes.
 *
 * Vellum note: the explorer is fully neutral — a per-type rainbow reads
 * childish against the Obsidian/Notion chrome. Everything is muted.
 */
export function getFileIconColor(fileName, isDirectory) {
  return 'text-app-muted';
}

/**
 * Combined FileIcon with color
 * Automatically applies appropriate color based on file type
 */
export function ColoredFileIcon({ fileName, isDirectory, isExpanded, className = "w-4 h-4", showChevron = true }) {
  const colorClass = getFileIconColor(fileName, isDirectory);
  const combinedClassName = `${className} ${colorClass}`;

  return (
    <FileIcon
      fileName={fileName}
      isDirectory={isDirectory}
      isExpanded={isExpanded}
      className={combinedClassName}
      showChevron={showChevron}
    />
  );
}
