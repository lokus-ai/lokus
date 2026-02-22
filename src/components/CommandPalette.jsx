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
  Trash2,
  Network,
  File,
  Target,
  Globe,
  Database,
  Calendar
} from 'lucide-react'
import { getActiveShortcuts, formatAccelerator } from '../core/shortcuts/registry'
import { useCommandHistory, createFileHistoryItem, createCommandHistoryItem } from '../hooks/useCommandHistory.js'
import { useTemplates, useTemplateProcessor } from '../hooks/useTemplates.js'
import { joinPath } from '../utils/pathUtils.js'
import { invoke } from '@tauri-apps/api/core'
import { useFolderScope } from '../contexts/FolderScopeContext'
import { useBases } from '../bases/BasesContext.jsx'
import { useFeatureFlags } from '../contexts/RemoteConfigContext'
import posthog from '../services/posthog.js'
import FolderSelector from './FolderSelector.jsx'
import { useCommands, useCommandExecute } from '../hooks/useCommands.js'
import { getMarkdownCompiler } from '../core/markdown/compiler.js'
import { isDesktop } from '../platform/index.js';

const markdownCompiler = getMarkdownCompiler()

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
  onOpenGraph,
  onShowTemplatePicker,
  onCreateTemplate,
  onOpenDailyNote,
  onRefresh,
  activeFile
}) {
  const [shortcuts, setShortcuts] = useState({})
  const [recentFiles, setRecentFiles] = useState([])
  const [showFolderSelector, setShowFolderSelector] = useState(false)
  const { formattedHistory, addToHistory, removeFromHistory, clearHistory } = useCommandHistory()
  const { templates } = useTemplates()
  const { process: processTemplate } = useTemplateProcessor()
  const { scopeMode, setLocalScope, setGlobalScope, getScopeStatus } = useFolderScope()
  const { createBase, bases, loadBase, dataManager } = useBases()
  const featureFlags = useFeatureFlags()

  // Use the new useCommands hook for plugin commands
  const pluginCommands = useCommands()
  const executeCommand = useCommandExecute()

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
      const fullPath = path ? joinPath(path, entry.name) : entry.name
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

  // Folder scope handlers
  const handleOpenFolderSelector = React.useCallback(() => {
    setShowFolderSelector(true)
    setOpen(false)
  }, [setOpen])

  const handleFolderSelectorConfirm = React.useCallback((selectedFolders) => {
    if (selectedFolders.length === 0) {
      setGlobalScope()
    } else {
      setLocalScope(selectedFolders)
    }
    setShowFolderSelector(false)
    // Refresh file tree to update UI
    if (onRefresh) {
      onRefresh()
    }
  }, [setLocalScope, setGlobalScope, onRefresh])

  const handleToggleScope = React.useCallback(() => {
    if (scopeMode === 'global') {
      // Can't toggle to local without selecting folders
      handleOpenFolderSelector()
    } else {
      setGlobalScope()
      // Refresh file tree to update UI
      if (onRefresh) {
        onRefresh()
      }
    }
  }, [scopeMode, setGlobalScope, handleOpenFolderSelector, onRefresh])

  // Handle template selection
  const handleTemplateSelect = React.useCallback(async (template) => {

    try {
      const result = await processTemplate(template.id, {}, {
        context: {}
      })

      const markdownContent = result.result || result.content || result;
      const htmlContent = await markdownCompiler.compile(markdownContent)

      // Track template feature activation
      posthog.trackFeatureActivation('templates')

      // Dispatch event to insert template into editor
      window.dispatchEvent(new CustomEvent('lokus:insert-template', {
        detail: {
          template,
          content: htmlContent
        }
      }))

      // Close command palette
      setOpen(false)
    } catch (err) {
      // Fallback to raw template content
      window.dispatchEvent(new CustomEvent('lokus:insert-template', {
        detail: {
          template,
          content: template.content
        }
      }))
      setOpen(false)
    }
  }, [processTemplate, setOpen])

  const [inputValue, setInputValue] = React.useState('')
  const [commandMode, setCommandMode] = useState(null)
  const [commandParams, setCommandParams] = useState({})
  const [filteredOptions, setFilteredOptions] = useState([])

  // Bases file search
  const [basesFiles, setBasesFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])

  // Structured command handling
  const detectStructuredCommands = (_input) => {
    return null
  }

  const getFilteredFiles = React.useCallback((query) => {
    if (!allFiles || allFiles.length === 0) return []

    const searchTerm = query.toLowerCase()
    return allFiles
      .filter(file => {
        const fileName = file.name.toLowerCase()
        const path = file.path.toLowerCase()
        return fileName.includes(searchTerm) || path.includes(searchTerm)
      })
      .slice(0, 10) // Show top 10 matches
  }, [allFiles])

  // Load files from Bases when palette opens (only if not cached)
  useEffect(() => {
    if (open && dataManager && basesFiles.length === 0) {
      dataManager.getAllFiles()
        .then(files => {
          setBasesFiles(files)
        })
        .catch(error => {
          // Fallback to current file tree
          setBasesFiles(flattenFileTree(fileTree))
        })
    } else if (open && basesFiles.length > 0) {
    } else {
    }
  }, [open, dataManager]) // Removed fileTree to prevent excessive re-runs

  // Filter files as user types
  useEffect(() => {

    if (!inputValue.trim() || commandMode) {
      setFilteredFiles([])
      return
    }

    const searchTerm = inputValue.toLowerCase()
    const filtered = basesFiles
      .filter(file => {
        const fileName = file.name.toLowerCase()
        const filePath = (file.path || '').toLowerCase()
        return fileName.includes(searchTerm) || filePath.includes(searchTerm)
      })
      .slice(0, 10)

    setFilteredFiles(filtered)
  }, [inputValue, commandMode, basesFiles])

  // Update filtered options based on current command mode and input
  useEffect(() => {
    setFilteredOptions([])
  }, [commandMode, inputValue])

  // Real-time command parsing as user types
  React.useEffect(() => {
    // Check for structured commands first
    const structuredMode = detectStructuredCommands(inputValue)
    if (structuredMode && !commandMode) {
      setCommandMode(structuredMode)
      setCommandParams({})
      setInputValue('')
    }
  }, [inputValue, commandMode])

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (commandMode) {
        setCommandMode(null)
        setCommandParams({})
        setInputValue('')
        setFilteredOptions([])
      } else {
        setInputValue('')
        setFilteredOptions([])
      }
    }
    // Let cmdk's built-in handler trigger onSelect for regular command items
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Type a command or search files..."
          value={inputValue}
          onValueChange={setInputValue}
          onKeyDown={handleInputKeyDown}
        />

        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* File Actions */}
          <CommandGroup heading="File">
            <CommandItem onSelect={() => runCommandWithHistory(onCreateFile, 'New File')}>
              <Plus className="mr-2 h-4 w-4" />
              <span>New File</span>
              {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['new-file'])}</CommandShortcut>)}
            </CommandItem>
            <CommandItem onSelect={() => runCommandWithHistory(onCreateFolder, 'New Folder')}>
              <FolderPlus className="mr-2 h-4 w-4" />
              <span>New Folder</span>
              {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['new-folder'])}</CommandShortcut>)}
            </CommandItem>
            <CommandItem onSelect={() => runCommandWithHistory(onOpenDailyNote, 'Open Daily Note')}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Open Daily Note</span>
              {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['daily-note'])}</CommandShortcut>)}
            </CommandItem>
            {activeFile && (
              <>
                <CommandItem onSelect={() => runCommandWithHistory(onSave, 'Save File', { fileName: activeFile.name })}>
                  <Save className="mr-2 h-4 w-4" />
                  <span>Save File</span>
                  {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['save-file'])}</CommandShortcut>)}
                </CommandItem>
                <CommandItem onSelect={() => runCommandWithHistory(() => onCloseTab(activeFile), 'Close Tab', { fileName: activeFile.name })}>
                  <X className="mr-2 h-4 w-4" />
                  <span>Close Tab</span>
                  {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['close-tab'])}</CommandShortcut>)}
                </CommandItem>
                {/* Individual template commands */}
                {templates.map((template) => (
                  <CommandItem
                    key={template.id}
                    onSelect={() => runCommandWithHistory(() => handleTemplateSelect(template), `Template: ${template.name}`, { templateId: template.id })}
                    disabled={!onShowTemplatePicker}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Template: {template.name}</span>
                    <CommandShortcut className="text-xs">{template.category}</CommandShortcut>
                  </CommandItem>
                ))}
                {/* Save as Template command */}
                <CommandItem
                  onSelect={() => runCommandWithHistory(() => onCreateTemplate && onCreateTemplate(), 'Save as Template')}
                  disabled={!onCreateTemplate}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Save as Template</span>
                  {isDesktop() && <CommandShortcut>S</CommandShortcut>}
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
              {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['toggle-sidebar'])}</CommandShortcut>)}
            </CommandItem>
            <CommandItem onSelect={() => runCommandWithHistory(onOpenPreferences, 'Open Preferences')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Open Preferences</span>
              {isDesktop() && (<CommandShortcut>{formatAccelerator(shortcuts['open-preferences'])}</CommandShortcut>)}
            </CommandItem>
            <CommandItem onSelect={() => runCommandWithHistory(onOpenGraph, 'Open Graph View')}>
              <Network className="mr-2 h-4 w-4" />
              <span>Professional Graph View</span>
              {isDesktop() && <CommandShortcut>⌘G</CommandShortcut>}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Folder Scope */}
          <CommandGroup heading="Folder Scope">
            <CommandItem onSelect={() => runCommandWithHistory(handleOpenFolderSelector, 'Switch to Local View')}>
              <Target className="mr-2 h-4 w-4" />
              <span>Switch to Local View</span>
              {isDesktop() && <CommandShortcut>⌘⇧L</CommandShortcut>}
            </CommandItem>
            {scopeMode === 'local' && (
              <CommandItem onSelect={() => runCommandWithHistory(() => {
                setGlobalScope();
                if (onRefresh) onRefresh();
              }, 'Switch to Global View')}>
                <Globe className="mr-2 h-4 w-4" />
                <span>Switch to Global View</span>
                <div className="ml-auto text-xs text-app-muted">
                  {getScopeStatus().description}
                </div>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          {/* Bases Commands */}
          <CommandGroup heading="Bases">
            <CommandItem onSelect={() => runCommandWithHistory(async () => {
              try {
                const result = await createBase('New Base', {
                  description: 'A new base for organizing notes'
                });
                if (result.success) {
                }
              } catch { }
            }, 'Create New Base')}>
              <Database className="mr-2 h-4 w-4" />
              <span>Create New Base</span>
              {isDesktop() && <CommandShortcut>⌘⇧B</CommandShortcut>}
            </CommandItem>
            {bases && bases.length > 0 && bases.map((base) => (
              <CommandItem
                key={base.path}
                onSelect={() => runCommandWithHistory(() => {
                  loadBase(base.path);
                }, `Open Base: ${base.name}`)}
              >
                <Database className="mr-2 h-4 w-4" />
                <span>Open {base.name}</span>
                {isDesktop() && <CommandShortcut className="text-xs">{base.description || 'Base'}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />

          {/* Plugin Commands - only show when plugins are enabled */}
          {featureFlags.enable_plugins && pluginCommands.length > 0 && (
            <>
              <CommandGroup heading="Plugin Commands">
                {pluginCommands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => runCommandWithHistory(
                      async () => {
                        try {
                          await executeCommand(cmd.id);
                        } catch (error) {
                          console.error(`Failed to execute command ${cmd.id}:`, error);
                        }
                      },
                      cmd.title || cmd.id,
                      { commandId: cmd.id, pluginId: cmd.pluginId }
                    )}
                  >
                    {cmd.icon ? (
                      typeof cmd.icon === 'string' ? (
                        <FileText className="mr-2 h-4 w-4" />
                      ) : (
                        <cmd.icon className="mr-2 h-4 w-4" />
                      )
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    <span>{cmd.title || cmd.id}</span>
                    {isDesktop() && cmd.category && (
                      <CommandShortcut className="text-xs">{cmd.category}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

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

          {/* File Search - Only show when user is typing */}
          {filteredFiles.length > 0 && inputValue.trim() && !commandMode && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Files">
                {filteredFiles.map((file) => (
                  <CommandItem
                    key={file.path}
                    value={file.name}
                    onSelect={() => openFileWithHistory(file)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>{file.name}</span>
                    <CommandShortcut className="text-xs">{file.path}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Command History */}
          {formattedHistory.length > 0 && (
            <>
              <CommandSeparator />
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
                          case 'Open Graph View':
                            runCommand(onOpenGraph)
                            break
                          case 'Insert Template':
                            if (onShowTemplatePicker) {
                              runCommand(onShowTemplatePicker)
                            }
                            break
                          default:
                        }
                      }
                    }}
                    className="group"
                  >
                    <History className="mr-2 h-4 w-4 opacity-60" />
                    <span className="flex-1">{historyItem.displayName}</span>
                    <span className="text-xs text-app-muted mr-2">{historyItem.relativeTime}</span>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        removeFromHistory(historyItem.id)
                      }}
                      tabIndex={-1}
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
            </>
          )}
        </CommandList>
      </CommandDialog>

      {/* Folder Selector Modal */}
      <FolderSelector
        fileTree={fileTree}
        isOpen={showFolderSelector}
        onClose={() => setShowFolderSelector(false)}
        onConfirm={handleFolderSelectorConfirm}
      />
    </>
  )
}