import React from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuShortcut,
} from './ui/context-menu';
import {
  FilePlus,
  FolderPlus,
  FileText,
  FolderOpen,
  Eye,
  ExternalLink,
  Terminal,
  Scissors,
  Copy,
  Clipboard,
  Files,
  Pencil,
  Trash2,
  Link,
  Search,
  GitBranch,
  RefreshCw,
  Download,
  Upload,
  Archive,
  Star,
  StarOff,
  Tag,
  FileCode,
  Image as ImageIcon,
  Film,
  Music,
  Database,
  FolderTree,
  ArrowRight,
  Clock,
} from 'lucide-react';
import platformService from '../services/platform/PlatformService';
import { isDesktop } from '../services/platform/PlatformService';

export default function FileContextMenu({
  children,
  file,
  onAction,
  canCut = false,
  canCopy = false,
  canPaste = false,
  isFavorite = false,
}) {
  const isFile = file?.type === 'file';
  const isFolder = file?.type === 'folder';
  const isWindows = platformService.isWindows();
  const isMac = platformService.isMacOS();

  const handleAction = (action, data = {}) => {
    if (onAction) {
      onAction(action, { ...data, file });
    }
  };

  const getFileTypeIcon = () => {
    if (isFolder) return <FolderOpen className="mr-2 h-4 w-4" />;
    if (!file?.name) return <FileText className="mr-2 h-4 w-4" />;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go'].includes(ext)) {
      return <FileCode className="mr-2 h-4 w-4" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return <ImageIcon className="mr-2 h-4 w-4" />;
    }
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      return <Film className="mr-2 h-4 w-4" />;
    }
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
      return <Music className="mr-2 h-4 w-4" />;
    }
    if (['db', 'sqlite', 'sql'].includes(ext)) {
      return <Database className="mr-2 h-4 w-4" />;
    }
    return <FileText className="mr-2 h-4 w-4" />;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72">
        {/* New File/Folder */}
        {isFolder && (
          <>
            <ContextMenuItem onClick={() => handleAction('newFile')}>
              <FilePlus className="mr-2 h-4 w-4" />
              New File
              <ContextMenuShortcut>{isWindows ? 'Ctrl+N' : '⌘N'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleAction('newFolder')}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+N' : '⌘⇧N'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Open Operations */}
        {file && (
          <>
            <ContextMenuItem onClick={() => handleAction('open')}>
              {getFileTypeIcon()}
              Open
              <ContextMenuShortcut>Enter</ContextMenuShortcut>
            </ContextMenuItem>

            {isFile && (
              <>
                <ContextMenuItem onClick={() => handleAction('openToSide')}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Open to the Side
                  <ContextMenuShortcut>{isWindows ? 'Ctrl+Enter' : '⌘Enter'}</ContextMenuShortcut>
                </ContextMenuItem>

                <ContextMenuItem onClick={() => handleAction('viewHistory')}>
                  <Clock className="mr-2 h-4 w-4" />
                  View History
                  <ContextMenuShortcut>{isWindows ? 'Ctrl+H' : '⌘H'}</ContextMenuShortcut>
                </ContextMenuItem>

                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open With...
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    <ContextMenuItem onClick={() => handleAction('openWithDefault')}>
                      <FileText className="mr-2 h-4 w-4" />
                      Default Editor
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleAction('openWithExternal')}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      External Application
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleAction('openWithSystem')}>
                      <Eye className="mr-2 h-4 w-4" />
                      System Default
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </>
            )}

            <ContextMenuSeparator />
          </>
        )}

        {/* Reveal Operations */}
        {file && (
          <>
            <ContextMenuItem onClick={() => handleAction('revealInFinder')}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {isMac ? 'Reveal in Finder' : isWindows ? 'Reveal in File Explorer' : 'Show in File Manager'}
              <ContextMenuShortcut>{isWindows ? 'Alt+R' : '⌥R'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleAction('openInTerminal')}>
              <Terminal className="mr-2 h-4 w-4" />
              Open in {isWindows ? 'Command Prompt' : isMac ? 'Terminal' : 'Terminal'}
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Edit Operations */}
        {file && (
          <>
            <ContextMenuItem
              onClick={() => handleAction('cut')}
              disabled={!canCut}
            >
              <Scissors className="mr-2 h-4 w-4" />
              Cut
              <ContextMenuShortcut>{isWindows ? 'Ctrl+X' : '⌘X'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => handleAction('copy')}
              disabled={!canCopy}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
              <ContextMenuShortcut>{isWindows ? 'Ctrl+C' : '⌘C'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleAction('duplicate')}>
              <Files className="mr-2 h-4 w-4" />
              Duplicate
              <ContextMenuShortcut>{isWindows ? 'Ctrl+D' : '⌘D'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Paste */}
        {(isFolder || file) && (
          <>
            <ContextMenuItem
              onClick={() => handleAction('paste')}
              disabled={!canPaste}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Paste
              <ContextMenuShortcut>{isWindows ? 'Ctrl+V' : '⌘V'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Rename and Delete */}
        {file && (
          <>
            <ContextMenuItem onClick={() => handleAction('rename')}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
              <ContextMenuShortcut>F2</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleAction('delete')}>
              <Trash2 className="mr-2 h-4 w-4 text-red-500" />
              <span className="text-red-500">Delete</span>
              <ContextMenuShortcut>{isWindows ? 'Del' : '⌘⌫'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Copy Path Operations */}
        {file && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Link className="mr-2 h-4 w-4" />
                Copy Path
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                <ContextMenuItem onClick={() => handleAction('copyPath')}>
                  <Link className="mr-2 h-4 w-4" />
                  Copy Path
                  <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+C' : '⌘⇧C'}</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleAction('copyRelativePath')}>
                  <Link className="mr-2 h-4 w-4" />
                  Copy Relative Path
                  <ContextMenuShortcut>{isWindows ? 'Ctrl+K Ctrl+Shift+C' : '⌘K ⌘⇧C'}</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />
          </>
        )}

        {/* Search Operations */}
        {isFolder && file && (
          <>
            <ContextMenuItem onClick={() => handleAction('findInFolder')}>
              <Search className="mr-2 h-4 w-4" />
              Find in Folder...
              <ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+F' : '⌘⇧F'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Compare Operations */}
        {isDesktop() && file && isFile && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <GitBranch className="mr-2 h-4 w-4" />
                Compare
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                <ContextMenuItem onClick={() => handleAction('compareWithClipboard')}>
                  <Clipboard className="mr-2 h-4 w-4" />
                  Compare with Clipboard
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleAction('compareWithSelected')}>
                  <Files className="mr-2 h-4 w-4" />
                  Compare with Selected
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />
          </>
        )}

        {/* Favorites */}
        {file && (
          <>
            <ContextMenuItem onClick={() => handleAction('toggleFavorite')}>
              {isFavorite ? (
                <>
                  <StarOff className="mr-2 h-4 w-4" />
                  Remove from Favorites
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" />
                  Add to Favorites
                </>
              )}
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {/* Tags */}
        {file && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Tag className="mr-2 h-4 w-4" />
                Tags
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                <ContextMenuItem onClick={() => handleAction('addTag')}>
                  <Tag className="mr-2 h-4 w-4" />
                  Add Tag...
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleAction('manageTags')}>
                  <Tag className="mr-2 h-4 w-4" />
                  Manage Tags...
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />
          </>
        )}

        {/* Export/Import */}
        {file && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Download className="mr-2 h-4 w-4" />
                Export
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                <ContextMenuItem onClick={() => handleAction('exportFile')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export File...
                </ContextMenuItem>
                {isFolder && (
                  <ContextMenuItem onClick={() => handleAction('exportArchive')}>
                    <Archive className="mr-2 h-4 w-4" />
                    Export as Archive...
                  </ContextMenuItem>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>

            {isFolder && (
              <ContextMenuItem onClick={() => handleAction('importFile')}>
                <Upload className="mr-2 h-4 w-4" />
                Import File...
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />
          </>
        )}

        {/* Refresh */}
        {isFolder && file && (
          <ContextMenuItem onClick={() => handleAction('refresh')}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
            <ContextMenuShortcut>F5</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Properties */}
        {file && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleAction('properties')}>
              <FolderTree className="mr-2 h-4 w-4" />
              Properties
              <ContextMenuShortcut>{isWindows ? 'Alt+Enter' : '⌘I'}</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
