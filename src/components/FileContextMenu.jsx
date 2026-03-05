import React, { useRef, useCallback, useState, useMemo } from 'react';
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
import { isMobile } from '../platform/index.js';
import { useLongPress } from '../hooks/useLongPress';
import { useFeatureFlags } from '../contexts/RemoteConfigContext';

export default function FileContextMenu({
  children,
  file,
  onAction,
  canCut = false,
  canCopy = false,
  canPaste = false,
  isFavorite = false,
  selectedPaths = new Set(),
  isSelected = false,
}) {
  const featureFlags = useFeatureFlags();
  const isFile = file?.type === 'file';
  const isFolder = file?.type === 'folder';
  const isWindows = platformService.isWindows();
  const isMac = platformService.isMacOS();
  const mobile = isMobile();

  // Ref to the trigger element so we can dispatch a synthetic contextmenu event
  const triggerRef = useRef(null);

  // Track whether user is currently pressing (for visual feedback)
  const [isPressing, setIsPressing] = useState(false);

  // On long-press (mobile only): dispatch a synthetic contextmenu event
  // so Radix ContextMenu opens at the correct position
  const handleLongPress = useCallback((e) => {
    const el = triggerRef.current;
    if (!el) return;

    // Haptic feedback (works on Android; no-op on iOS Safari)
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Reset visual feedback
    setIsPressing(false);

    // Determine coordinates from the touch/mouse event
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch?.clientX ?? e.clientX ?? 0;
    const clientY = touch?.clientY ?? e.clientY ?? 0;

    // Prevent the default context menu / text selection
    e.preventDefault?.();

    // Dispatch a synthetic contextmenu event that Radix will handle
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    });
    el.dispatchEvent(contextMenuEvent);
  }, []);

  const longPressHandlers = useLongPress(handleLongPress, 500);

  // Wrap long-press handlers to also toggle visual pressing state
  const wrappedHandlers = useMemo(() => {
    if (!mobile) return {};
    return {
      ...longPressHandlers,
      onTouchStart: (e) => {
        setIsPressing(true);
        longPressHandlers.onTouchStart(e);
      },
      onTouchEnd: (e) => {
        setIsPressing(false);
        longPressHandlers.onTouchEnd(e);
      },
      onTouchMove: (e) => {
        setIsPressing(false);
        longPressHandlers.onTouchMove(e);
      },
    };
  }, [mobile, longPressHandlers]);

  // Check if we're in multi-select mode (more than 1 item selected and current item is selected)
  const isMultiSelect = selectedPaths.size > 1 && isSelected;
  const selectedCount = selectedPaths.size;

  const handleAction = (action, data = {}) => {
    if (onAction) {
      onAction(action, { ...data, file, selectedPaths, isMultiSelect });
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
        <div
          ref={triggerRef}
          {...wrappedHandlers}
          style={mobile && isPressing ? {
            transform: 'scale(0.97)',
            opacity: 0.85,
            transition: 'transform 0.15s ease, opacity 0.15s ease',
          } : {
            transform: 'scale(1)',
            opacity: 1,
            transition: 'transform 0.15s ease, opacity 0.15s ease',
          }}
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72">
        {/* Multi-select bulk operations */}
        {isMultiSelect && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {selectedCount} items selected
            </div>
            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => handleAction('deleteSelected')}>
              <Trash2 className="mr-2 h-4 w-4 text-red-500" />
              <span className="text-red-500">Delete {selectedCount} Items</span>
              {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Del' : '⌫'}</ContextMenuShortcut>)}
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => handleAction('cutSelected')}>
              <Scissors className="mr-2 h-4 w-4" />
              Cut {selectedCount} Items
              {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+X' : '⌘X'}</ContextMenuShortcut>)}
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleAction('copySelected')}>
              <Copy className="mr-2 h-4 w-4" />
              Copy {selectedCount} Items
              {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+C' : '⌘C'}</ContextMenuShortcut>)}
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleAction('duplicateSelected')}>
              <Files className="mr-2 h-4 w-4" />
              Duplicate {selectedCount} Items
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => handleAction('moveSelected')}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Move to...
            </ContextMenuItem>

            <ContextMenuSeparator />

            {featureFlags.enable_import_export && (
              <ContextMenuItem onClick={() => handleAction('exportSelected')}>
                <Download className="mr-2 h-4 w-4" />
                Export {selectedCount} Items...
              </ContextMenuItem>
            )}

            {featureFlags.enable_import_export && (
              <ContextMenuItem onClick={() => handleAction('archiveSelected')}>
                <Archive className="mr-2 h-4 w-4" />
                Create Archive...
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Single item operations - only show when not in multi-select mode */}
        {!isMultiSelect && (
          <>
            {/* New File/Folder */}
            {isFolder && (
              <>
                <ContextMenuItem onClick={() => handleAction('newFile')}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  New File
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+N' : '⌘N'}</ContextMenuShortcut>)}
                </ContextMenuItem>

                <ContextMenuItem onClick={() => handleAction('newFolder')}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+N' : '⌘⇧N'}</ContextMenuShortcut>)}
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
                  {isDesktop() && <ContextMenuShortcut>Enter</ContextMenuShortcut>}
                </ContextMenuItem>

                {isFile && (
                  <>
                    <ContextMenuItem onClick={() => handleAction('openToSide')}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Open to the Side
                      {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+Enter' : '⌘Enter'}</ContextMenuShortcut>)}
                    </ContextMenuItem>

                    {featureFlags.enable_version_history && (
                      <ContextMenuItem onClick={() => handleAction('viewHistory')}>
                        <Clock className="mr-2 h-4 w-4" />
                        View History
                        {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+H' : '⌘H'}</ContextMenuShortcut>)}
                      </ContextMenuItem>
                    )}

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
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Alt+R' : '⌥R'}</ContextMenuShortcut>)}
                </ContextMenuItem>

                {isDesktop() && featureFlags.enable_terminal && (
                  <ContextMenuItem onClick={() => handleAction('openInTerminal')}>
                    <Terminal className="mr-2 h-4 w-4" />
                    Open in {isWindows ? 'Command Prompt' : isMac ? 'Terminal' : 'Terminal'}
                  </ContextMenuItem>
                )}

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
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+X' : '⌘X'}</ContextMenuShortcut>)}
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => handleAction('copy')}
                  disabled={!canCopy}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+C' : '⌘C'}</ContextMenuShortcut>)}
                </ContextMenuItem>

                <ContextMenuItem onClick={() => handleAction('duplicate')}>
                  <Files className="mr-2 h-4 w-4" />
                  Duplicate
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+D' : '⌘D'}</ContextMenuShortcut>)}
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
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+V' : '⌘V'}</ContextMenuShortcut>)}
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
                  {isDesktop() && <ContextMenuShortcut>F2</ContextMenuShortcut>}
                </ContextMenuItem>

                <ContextMenuItem onClick={() => handleAction('delete')}>
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Delete</span>
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Del' : '⌘⌫'}</ContextMenuShortcut>)}
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
                      {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+C' : '⌘⇧C'}</ContextMenuShortcut>)}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleAction('copyRelativePath')}>
                      <Link className="mr-2 h-4 w-4" />
                      Copy Relative Path
                      {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+K Ctrl+Shift+C' : '⌘K ⌘⇧C'}</ContextMenuShortcut>)}
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
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Ctrl+Shift+F' : '⌘⇧F'}</ContextMenuShortcut>)}
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
            {file && featureFlags.enable_import_export && (
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
                {isDesktop() && (<ContextMenuShortcut>F5</ContextMenuShortcut>)}
              </ContextMenuItem>
            )}

            {/* Properties */}
            {file && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleAction('properties')}>
                  <FolderTree className="mr-2 h-4 w-4" />
                  Properties
                  {isDesktop() && (<ContextMenuShortcut>{isWindows ? 'Alt+Enter' : '⌘I'}</ContextMenuShortcut>)}
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
