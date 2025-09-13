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
  Clock
} from 'lucide-react'
import { getActiveShortcuts, formatAccelerator } from '../core/shortcuts/registry'

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

  useEffect(() => {
    getActiveShortcuts().then(setShortcuts)
  }, [])

  useEffect(() => {
    // Get recent files from openFiles (limit to 5)
    const recent = openFiles.slice(0, 5)
    setRecentFiles(recent)
  }, [openFiles])

  const runCommand = React.useCallback((command) => {
    setOpen(false)
    command()
  }, [setOpen])

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
        
        {/* File Actions */}
        <CommandGroup heading="File">
          <CommandItem onSelect={() => runCommand(onCreateFile)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New File</span>
            <CommandShortcut>{formatAccelerator(shortcuts['new-file'])}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onCreateFolder)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>New Folder</span>
            <CommandShortcut>{formatAccelerator(shortcuts['new-folder'])}</CommandShortcut>
          </CommandItem>
          {activeFile && (
            <>
              <CommandItem onSelect={() => runCommand(onSave)}>
                <Save className="mr-2 h-4 w-4" />
                <span>Save File</span>
                <CommandShortcut>{formatAccelerator(shortcuts['save-file'])}</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => onCloseTab(activeFile))}>
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
          <CommandItem onSelect={() => runCommand(onToggleSidebar)}>
            <ToggleLeft className="mr-2 h-4 w-4" />
            <span>Toggle Sidebar</span>
            <CommandShortcut>{formatAccelerator(shortcuts['toggle-sidebar'])}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onOpenPreferences)}>
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
                  onSelect={() => runCommand(() => onFileOpen(file))}
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
                  onSelect={() => runCommand(() => onFileOpen(file))}
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