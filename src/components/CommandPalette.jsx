import React, { useState, useEffect } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from './ui/command'
import { 
  FileText, 
  FolderPlus, 
  Settings, 
  Search,
  Save,
  Plus,
  X,
  ToggleLeft,
  Clock,
  History,
  Trash2
} from 'lucide-react'
import { getActiveShortcuts, formatAccelerator } from '../core/shortcuts/registry'
import { useCommandHistory, createFileHistoryItem, createCommandHistoryItem } from '../hooks/useCommandHistory.js'

export default function CommandPalette({ 
  open, 
  setOpen, 
  fileTree = [], 
  openFiles = [], 
  onFileOpen, 
  onCreateFile, 
  onCreateFolder, 
  onSave, 
  onOpenPreferences, 
  onToggleSidebar, 
  onCloseTab,
  activeFile 
}) {
  const [shortcuts, setShortcuts] = useState({})
  const [recentFiles, setRecentFiles] = useState([])
  const { formattedHistory, addToHistory, removeFromHistory, clearHistory } = useCommandHistory()

  useEffect(() => {
    getActiveShortcuts().then(setShortcuts)
  }, [])

  useEffect(() => {
    // Get recent files from openFiles (limit to 5)
    const recent = openFiles.slice(0, 5)
    setRecentFiles(recent)
  }, [openFiles])

  const runCommand = React.useCallback((command, historyItem = null) => {
    setOpen(false)
    if (historyItem) {
      addToHistory(historyItem)
    }
    command()
  }, [setOpen, addToHistory])

  // Enhanced file opening with history tracking
  const openFileWithHistory = React.useCallback((file) => {
    const historyItem = createFileHistoryItem(file)
    runCommand(() => onFileOpen(file), historyItem)
  }, [runCommand, onFileOpen])

  // Enhanced command execution with history tracking  
  const runCommandWithHistory = React.useCallback((command, commandName, commandData = {}) => {
    const historyItem = createCommandHistoryItem(commandName, commandData)
    runCommand(command, historyItem)
  }, [runCommand])

  // Flatten file tree for search
  const flattenFileTree = (entries, path = '') => {
    let files = []
    entries.forEach(entry => {
      const fullPath = path ? `${path}/${entry.name}` : entry.name
      if (entry.is_directory) {
        if (entry.children) {
          files = files.concat(flattenFileTree(entry.children, fullPath))
        }
      } else {
        files.push({ ...entry, fullPath })
      }
    })
    return files
  }

  const allFiles = flattenFileTree(fileTree)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search files..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Command History */}
        {formattedHistory.length > 0 && (
          <>
            <CommandGroup heading="History">
              {formattedHistory.slice(0, 8).map((historyItem) => (
                <CommandItem
                  key={historyItem.id}
                  onSelect={() => {
                    if (historyItem.type === 'file') {
                      runCommand(() => onFileOpen(historyItem.data))
                    } else if (historyItem.type === 'command') {
                      // Re-execute the command from history
                      const commandName = historyItem.data.command
                      switch (commandName) {
                        case 'New File':
                          runCommand(onCreateFile)
                          break
                        case 'New Folder':
                          runCommand(onCreateFolder)
                          break
                        case 'Save File':
                          runCommand(onSave)
                          break
                        case 'Toggle Sidebar':
                          runCommand(onToggleSidebar)
                          break
                        case 'Open Preferences':
                          runCommand(onOpenPreferences)
                          break
                        default:
                          console.warn(`Unknown command: ${commandName}`)
                      }
                    }
                  }}
                  className="group"
                >
                  <History className="mr-2 h-4 w-4 opacity-60" />
                  <span className="flex-1">{historyItem.displayName}</span>
                  <span className="text-xs text-app-muted mr-2">{historyItem.relativeTime}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFromHistory(historyItem.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1 rounded"
                    title="Remove from history"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </CommandItem>
              ))}
              {formattedHistory.length > 8 && (
                <CommandItem disabled>
                  <span className="text-app-muted">...and {formattedHistory.length - 8} more items</span>
                </CommandItem>
              )}
              <CommandSeparator />
              <CommandItem onSelect={() => runCommand(clearHistory)}>
                <Trash2 className="mr-2 h-4 w-4 opacity-60" />
                <span className="text-app-muted">Clear History</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        
        {/* File Actions */}
        <CommandGroup heading="File">
          <CommandItem onSelect={() => runCommandWithHistory(onCreateFile, 'New File')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New File</span>
            <CommandShortcut>{formatAccelerator(shortcuts['new-file'])}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommandWithHistory(onCreateFolder, 'New Folder')}>
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>New Folder</span>
            <CommandShortcut>{formatAccelerator(shortcuts['new-folder'])}</CommandShortcut>
          </CommandItem>
          {activeFile && (
            <>
              <CommandItem onSelect={() => runCommandWithHistory(onSave, 'Save File', { fileName: activeFile.name })}>
                <Save className="mr-2 h-4 w-4" />
                <span>Save File</span>
                <CommandShortcut>{formatAccelerator(shortcuts['save-file'])}</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommandWithHistory(() => onCloseTab(activeFile), 'Close Tab', { fileName: activeFile.name })}>
                <X className="mr-2 h-4 w-4" />
                <span>Close Tab</span>
                <CommandShortcut>{formatAccelerator(shortcuts['close-tab'])}</CommandShortcut>
              </CommandItem>
            </>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* View Actions */}
        <CommandGroup heading="View">
          <CommandItem onSelect={() => runCommandWithHistory(onToggleSidebar, 'Toggle Sidebar')}>
            <ToggleLeft className="mr-2 h-4 w-4" />
            <span>Toggle Sidebar</span>
            <CommandShortcut>{formatAccelerator(shortcuts['toggle-sidebar'])}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommandWithHistory(onOpenPreferences, 'Open Preferences')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Open Preferences</span>
            <CommandShortcut>{formatAccelerator(shortcuts['open-preferences'])}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Files">
              {recentFiles.map((file) => (
                <CommandItem
                  key={file.path}
                  onSelect={() => openFileWithHistory(file)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{file.name}</span>
                  <CommandShortcut className="text-xs">{file.path}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* All Files Search */}
        {allFiles.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Files">
              {allFiles.slice(0, 10).map((file) => (
                <CommandItem
                  key={file.path}
                  onSelect={() => openFileWithHistory(file)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{file.name}</span>
                  <CommandShortcut className="text-xs">{file.fullPath}</CommandShortcut>
                </CommandItem>
              ))}
              {allFiles.length > 10 && (
                <CommandItem disabled>
                  <span className="text-app-muted">...and {allFiles.length - 10} more files</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}