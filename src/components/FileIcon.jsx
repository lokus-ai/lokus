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
  'canvas': Layout,
  'kanban': Trello,

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
 * Returns Tailwind color classes
 */
export function getFileIconColor(fileName, isDirectory) {
  if (isDirectory) {
    return 'text-blue-500';
  }

  if (!fileName) return 'text-app-muted';

  const extension = fileName.split('.').pop()?.toLowerCase();

  // Color mapping for different file types
  const colorMap = {
    // Markdown & Text - Purple
    'md': 'text-purple-500',
    'markdown': 'text-purple-500',
    'txt': 'text-gray-500',

    // JavaScript/TypeScript - Yellow
    'js': 'text-yellow-500',
    'jsx': 'text-yellow-500',
    'ts': 'text-blue-500',
    'tsx': 'text-blue-500',

    // Web - Orange/Red
    'html': 'text-orange-500',
    'css': 'text-blue-400',
    'scss': 'text-pink-500',

    // Python - Blue
    'py': 'text-blue-500',

    // Data - Green
    'json': 'text-yellow-600',
    'yaml': 'text-red-500',
    'yml': 'text-red-500',

    // Images - Purple
    'png': 'text-purple-400',
    'jpg': 'text-purple-400',
    'jpeg': 'text-purple-400',
    'svg': 'text-orange-400',

    // Special Lokus
    'canvas': 'text-green-500',
    'kanban': 'text-teal-500',

    // Database
    'sql': 'text-orange-500',
    'db': 'text-orange-500',
  };

  return colorMap[extension] || 'text-app-muted';
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
