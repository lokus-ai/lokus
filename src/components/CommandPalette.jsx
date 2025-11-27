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
  Mail,
  Send,
  Archive,
  Star,
  ArrowRight,
  User,
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
import { gmailEmails, gmailAuth } from '../services/gmail.js'
import { saveEmailAsNote } from '../utils/emailToNote.js'
import { invoke } from '@tauri-apps/api/core'
import { useFolderScope } from '../contexts/FolderScopeContext'
import { useBases } from '../bases/BasesContext.jsx'
import FolderSelector from './FolderSelector.jsx'

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
  onOpenGmail,
  onShowTemplatePicker,
  onCreateTemplate,
  onOpenDailyNote,
  activeFile
}) {
  const [shortcuts, setShortcuts] = useState({})
  const [recentFiles, setRecentFiles] = useState([])
  const [recentEmails, setRecentEmails] = useState([])
  const [isGmailAuthenticated, setIsGmailAuthenticated] = useState(false)
  const [showFolderSelector, setShowFolderSelector] = useState(false)
  const { formattedHistory, addToHistory, removeFromHistory, clearHistory } = useCommandHistory()
  const { templates } = useTemplates()
  const { process: processTemplate } = useTemplateProcessor()
  const { scopeMode, setLocalScope, setGlobalScope, getScopeStatus } = useFolderScope()
  const { createBase, bases, loadBase, dataManager } = useBases()

  useEffect(() => {
    getActiveShortcuts().then(setShortcuts)
  }, [])

  useEffect(() => {
    // Get recent files from openFiles (limit to 5)
    const recent = openFiles.slice(0, 5)
    setRecentFiles(recent)
  }, [openFiles])

  useEffect(() => {
    // Check Gmail authentication status and load recent emails
    const checkGmailAuth = async () => {
      try {
        const isAuth = await gmailAuth.isAuthenticated()
        setIsGmailAuthenticated(isAuth)
        
        if (isAuth) {
          // Load recent emails for quick access
          const emailsResponse = await gmailEmails.listEmails(10)
          // Handle response structure: { emails: [...], nextPageToken: ... }
          const emailsArray = emailsResponse.emails || emailsResponse || []
          setRecentEmails(emailsArray.slice(0, 5))
        }
      } catch (error) {
        console.error('Failed to check Gmail auth:', error)
        setIsGmailAuthenticated(false)
      }
    }
    
    if (open) {
      checkGmailAuth()
    }
  }, [open])

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


  // Helper function to ensure Gmail authentication
  const ensureGmailAuth = async () => {
    if (!isGmailAuthenticated) {
      const isAuth = await gmailAuth.isAuthenticated()
      if (!isAuth) {
        const authUrl = await gmailAuth.initiateAuth()
        // Open auth URL in default browser
        window.open(authUrl, '_blank')
        const authError = new Error('Please complete Gmail authentication in the opened browser window')
        authError.isAuthRedirect = true
        throw authError
      }
      setIsGmailAuthenticated(true)
    }
  }

  const handleReadEmail = React.useCallback(async (email) => {
    try {
      await ensureGmailAuth()
      
      // Open Gmail tab and select the email
      onOpenGmail()
      
      // Store the email ID for the Gmail component to open
      sessionStorage.setItem('gmailOpenEmail', email.id)
      
    } catch (error) {
      console.error('Failed to open email:', error)
      alert(`Failed to open email: ${error.message}`)
    }
  }, [isGmailAuthenticated, onOpenGmail])

  const handleGmailSearch = React.useCallback(async (query) => {
    try {
      await ensureGmailAuth()

      // Open Gmail with search query
      onOpenGmail()

      // Store search query for Gmail component
      sessionStorage.setItem('gmailSearch', query)

    } catch (error) {
      console.error('Failed to search emails:', error)
      alert(`Failed to search emails: ${error.message}`)
    }
  }, [isGmailAuthenticated, onOpenGmail])

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
  }, [setLocalScope, setGlobalScope])

  const handleToggleScope = React.useCallback(() => {
    if (scopeMode === 'global') {
      // Can't toggle to local without selecting folders
      handleOpenFolderSelector()
    } else {
      setGlobalScope()
    }
  }, [scopeMode, setGlobalScope, handleOpenFolderSelector])


  // Parse Gmail template from file content (supports flexible YAML, simple field, and Markdown formats)
  const parseGmailTemplate = (content) => {
    try {
      
      // Method 1: Try YAML frontmatter with flexible body handling
      if (content.startsWith('---')) {
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd !== -1) {
          const frontmatterContent = content.slice(3, frontmatterEnd).trim();
          const afterFrontmatter = content.slice(frontmatterEnd + 3).trim();
          
          const metadata = {};
          const lines = frontmatterContent.split('\n');
          let bodyBuffer = []; // For multi-line body field
          let currentKey = null;
          let inMultiLineBody = false;
          
          for (const line of lines) {
            const colonIndex = line.indexOf(':');
            
            if (colonIndex > 0 && !inMultiLineBody) {
              // New field
              const key = line.slice(0, colonIndex).trim().toLowerCase();
              const value = line.slice(colonIndex + 1).trim();
              
              if (key === 'body') {
                if (value === '|' || value === '') {
                  // Multi-line body starts
                  inMultiLineBody = true;
                  currentKey = 'body';
                  bodyBuffer = [];
                } else {
                  // Single line body
                  metadata[key] = value;
                }
              } else {
                metadata[key] = value;
              }
            } else if (inMultiLineBody && currentKey === 'body') {
              // Collecting multi-line body content
              bodyBuffer.push(line);
            } else if (colonIndex > 0) {
              // Handle other fields while in multi-line mode
              const key = line.slice(0, colonIndex).trim().toLowerCase();
              const value = line.slice(colonIndex + 1).trim();
              metadata[key] = value;
            }
          }
          
          // If we collected multi-line body content
          if (bodyBuffer.length > 0) {
            metadata.body = bodyBuffer.join('\n').trim();
          }
          
          // Determine body content
          let body = '';
          if (metadata.body) {
            // Use explicit body field
            body = metadata.body;
          } else if (afterFrontmatter) {
            // Use content after frontmatter
            body = afterFrontmatter.replace(/<!--.*?-->/gs, '').trim();
          }
          
          
          if (metadata.to !== undefined && metadata.subject !== undefined) {
            return {
              to: metadata.to ? metadata.to.split(',').map(email => email.trim()).filter(email => email) : [],
              cc: metadata.cc ? metadata.cc.split(',').map(email => email.trim()).filter(email => email) : [],
              bcc: metadata.bcc ? metadata.bcc.split(',').map(email => email.trim()).filter(email => email) : [],
              subject: metadata.subject || '',
              body: body
            };
          }
        }
      }

      // Method 2: Try simple field format (To:, Subject:, Body:)
      const lines = content.split('\n');
      const fields = {};
      let bodyStartIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const colonIndex = line.indexOf(':');
        
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim().toLowerCase();
          const value = line.slice(colonIndex + 1).trim();
          
          if (['to', 'subject', 'cc', 'bcc'].includes(key)) {
            fields[key] = value;
          } else if (key === 'body') {
            if (value === '' || value === '|') {
              // Multi-line body starts after this line
              bodyStartIndex = i + 1;
              break;
            } else {
              // Single line body
              fields.body = value;
            }
          }
        }
      }
      
      // Extract multi-line body if we found a body start
      if (bodyStartIndex > -1) {
        const bodyLines = lines.slice(bodyStartIndex);
        fields.body = bodyLines.join('\n').trim();
      }
      
      
      
      if (fields.to && fields.subject) {
        const result = {
          to: fields.to.split(',').map(email => email.trim()).filter(email => email),
          cc: fields.cc ? fields.cc.split(',').map(email => email.trim()).filter(email => email) : [],
          bcc: fields.bcc ? fields.bcc.split(',').map(email => email.trim()).filter(email => email) : [],
          subject: fields.subject,
          body: fields.body || ''
        };
        return result;
      }

      // Method 3: Try Markdown bold format (**To:**, **Subject:**) - legacy support
      const toMatch = content.match(/\*\*To:\*\*\s*(.+)/i);
      const subjectMatch = content.match(/\*\*Subject:\*\*\s*(.+)/i);
      const bodyMatch = content.match(/\*\*Body:\*\*\s*(.+)/is);
      
      if (toMatch && subjectMatch) {
        
        let body = '';
        if (bodyMatch) {
          // Explicit body field
          body = bodyMatch[1].trim();
        } else {
          // Look for content after separator
          const contentLines = content.split('\n');
          let bodyStartIndex = -1;
          let foundMetadata = false;
          
          for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i].trim();
            
            if (line.match(/\*\*To:\*\*|\*\*Subject:\*\*/i)) {
              foundMetadata = true;
            }
            
            if (foundMetadata && line === '---') {
              bodyStartIndex = i + 1;
              while (bodyStartIndex < contentLines.length && !contentLines[bodyStartIndex].trim()) {
                bodyStartIndex++;
              }
              break;
            }
          }
          
          if (bodyStartIndex > -1) {
            const bodyLines = [];
            for (let i = bodyStartIndex; i < contentLines.length; i++) {
              const line = contentLines[i];
              if (line.trim().match(/^\*\*.*:\*\*/) && i > bodyStartIndex + 3) {
                break;
              }
              bodyLines.push(line);
            }
            body = bodyLines.join('\n').trim();
          }
        }

        return {
          to: [toMatch[1].trim()],
          cc: [],
          bcc: [],
          subject: subjectMatch[1].trim(),
          body: body
        };
      }

    } catch (error) {
      console.error('Error parsing Gmail template:', error);
    }
    return null;
  };

  // Handle sending Gmail from selected file
  const handleSendGmailFromFile = React.useCallback(async (file) => {
    try {
      
      if (!isGmailAuthenticated) {
        await ensureGmailAuth()
      }
      
      
      // Read the file content using Tauri command
      const fileContent = await invoke('read_file_content', { path: file.path });
      
      // Parse Gmail template
      const gmailTemplate = parseGmailTemplate(fileContent);
      
      if (!gmailTemplate) {
        console.error(`❌ [DEBUG] File "${file.name}" is not a valid Gmail template`);
        return;
      }
      
      // Validate required fields
      if (gmailTemplate.to.length === 0) {
        console.error('❌ [DEBUG] Gmail template must have a "To:" field with at least one email address.');
        return;
      }
      
      if (!gmailTemplate.subject.trim()) {
        console.error('❌ [DEBUG] Gmail template must have a "Subject:" field.');
        return;
      }

      
      
      // Send the email
      const result = await gmailEmails.sendEmail({
        to: gmailTemplate.to,
        cc: gmailTemplate.cc,
        bcc: gmailTemplate.bcc,
        subject: gmailTemplate.subject,
        body: gmailTemplate.body,
        attachments: []
      });
      
      
      
    } catch (error) {
      if (error.isAuthRedirect) {
        // Show user-friendly message instead of error
        alert('Please complete Gmail authentication in the opened browser window, then try sending the email again.');
      } else {
        console.error('❌ [DEBUG] Failed to send Gmail from file:', error);
        console.error('❌ [DEBUG] Error stack:', error.stack);
        console.error(`❌ [DEBUG] Failed to send email: ${error.message}`);
        alert(`Failed to send email: ${error.message}`);
      }
    }
  }, [isGmailAuthenticated, parseGmailTemplate])

  // Handle template selection
  const handleTemplateSelect = React.useCallback(async (template) => {

    try {
      // Process the template with built-in variables
      const result = await processTemplate(template.id, {}, {
        context: {}
      })


      // Call onShowTemplatePicker with processed content
      if (onShowTemplatePicker) {
        // Create a mock event that mimics the TemplatePicker selection
        const mockSelection = {
          template,
          processedContent: result.result || result.content || result
        }
        onShowTemplatePicker(mockSelection)
      }

      // Close command palette
      setOpen(false)
    } catch (err) {
      console.error('[CommandPalette] ERROR processing template:', err);
      console.error('[CommandPalette] Error stack:', err.stack);
      // Fallback to raw template content
      if (onShowTemplatePicker) {
        const mockSelection = {
          template,
          processedContent: template.content
        }
        onShowTemplatePicker(mockSelection)
      }
      setOpen(false)
    }
  }, [processTemplate, onShowTemplatePicker, setOpen])

  // Parse Gmail commands from input
  const [inputValue, setInputValue] = React.useState('')
  const [parsedCommand, setParsedCommand] = React.useState(null)
  const [commandMode, setCommandMode] = useState(null) // 'send_email', 'search_emails', 'save_note', etc.
  const [commandParams, setCommandParams] = useState({}) // Parameters for current command
  const [filteredOptions, setFilteredOptions] = useState([]) // Options to show based on current input

  // Bases file search
  const [basesFiles, setBasesFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])

  // Email templates
  const emailTemplates = {
    meeting: {
      subject: "Meeting Follow-up",
      body: `Hi {{name}},

Thank you for taking the time to meet with me today. I wanted to follow up on our discussion about {{topic}}.

Key points from our meeting:
- {{point1}}
- {{point2}}
- {{point3}}

Next steps:
- {{action1}}
- {{action2}}

Please let me know if you have any questions or if there's anything else I can help with.

Best regards,
{{sender}}`
    },
    proposal: {
      subject: "Project Proposal - {{project_name}}",
      body: `Dear {{client_name}},

I hope this email finds you well. I'm writing to present a proposal for {{project_name}}.

Project Overview:
{{project_description}}

Timeline: {{timeline}}
Budget: {{budget}}

I believe this project aligns perfectly with your goals and would love to discuss it further.

Please let me know if you'd like to schedule a call to go over the details.

Best regards,
{{sender}}`
    },
    followup: {
      subject: "Following up on {{topic}}",
      body: `Hi {{name}},

I wanted to follow up on {{topic}} that we discussed {{when}}.

{{details}}

Looking forward to hearing from you.

Best regards,
{{sender}}`
    }
  }
  
  const parseGmailCommand = (input) => {
    const trimmedInput = input.trim()
    if (!trimmedInput) return null
    
    // Email pattern for auto-detection
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    const emails = trimmedInput.match(emailPattern) || []
    
    // File extension pattern
    const filePattern = /(\w+\.\w+)/g
    const files = trimmedInput.match(filePattern) || []
    
    // Subject extraction patterns
    const subjectPatterns = [
      /(?:subject:?\s*["']?([^"']+)["']?)/i,
      /(?:re:?\s*["']?([^"']+)["']?)/i,
      /(?:about\s+["']?([^"']+)["']?)/i,
      /(?:regarding\s+["']?([^"']+)["']?)/i
    ]
    
    let subject = null
    for (const pattern of subjectPatterns) {
      const match = trimmedInput.match(pattern)
      if (match) {
        subject = match[1].trim()
        break
      }
    }
    
    // Command type detection
    const lowerInput = trimmedInput.toLowerCase()
    
    // Send email patterns
    const sendPatterns = [
      /^(?:send|email|compose)\s+(?:email\s+)?(?:to\s+)?/i,
      /^(?:email|send)\s+(\S+)\s+to\s+/i, // "email filename to recipient"
      /^(?:send|email)\s+.*?(?:to|@)/i
    ]
    
    const isSendCommand = sendPatterns.some(pattern => pattern.test(trimmedInput))
    
    if (isSendCommand && emails.length > 0) {
      // Extract file content if file is mentioned
      const fileName = files.length > 0 ? files[0] : null
      
      // Auto-generate subject if not provided
      if (!subject && fileName) {
        subject = `Content from ${fileName}`
      } else if (!subject) {
        subject = 'Email from Lokus'
      }
      
      return {
        type: 'send',
        recipients: emails,
        fileName: fileName,
        subject: subject,
        originalCommand: trimmedInput
      }
    }
    
    // Search email patterns
    const searchPatterns = [
      /^(?:search|find|read)\s+(?:email|mail)s?\s+(?:about\s+|for\s+|from\s+)?(.+)/i,
      /^(?:read|show)\s+(?:email|mail)s?\s+(.+)/i,
      /^(?:email|mail)s?\s+(?:about|from|with)\s+(.+)/i
    ]
    
    for (const pattern of searchPatterns) {
      const match = trimmedInput.match(pattern)
      if (match) {
        return {
          type: 'search',
          query: match[1].trim(),
          originalCommand: trimmedInput
        }
      }
    }
    
    // Legacy exact patterns (for backward compatibility)
    const legacyPatterns = [
      { pattern: /^send\s+email:\s*([^:]+)\s+to:\s*(.+)$/i, type: 'send' },
      { pattern: /^(?:read|search)\s+email:\s*(.+)$/i, type: 'search' }
    ]
    
    for (const { pattern, type } of legacyPatterns) {
      const match = trimmedInput.match(pattern)
      if (match) {
        if (type === 'send') {
          return {
            type: 'send',
            fileName: match[1].trim(),
            recipients: [match[2].trim()],
            subject: `Content from ${match[1].trim()}`,
            originalCommand: trimmedInput
          }
        } else {
          return {
            type: 'search',
            query: match[1].trim(),
            originalCommand: trimmedInput
          }
        }
      }
    }
    
    return null
  }

  // Structured command handling
  const detectStructuredCommands = (input) => {
    const trimmed = input.trim().toLowerCase()
    
    // Commands that should enter structured mode
    const structuredCommands = {
      'search emails': 'search_emails',
      'gmail search': 'search_emails',
      'save email': 'save_note',
      'note email': 'save_note',
      'send gmail': 'send_gmail'
    }
    
    for (const [command, mode] of Object.entries(structuredCommands)) {
      if (trimmed === command || trimmed.startsWith(command + ' ')) {
        return mode
      }
    }
    
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

  const getFilteredEmails = React.useCallback((query) => {
    if (!recentEmails || recentEmails.length === 0) return []
    
    const searchTerm = query.toLowerCase()
    return recentEmails
      .filter(email => {
        const subject = (email.subject || '').toLowerCase()
        const from = Array.isArray(email.from) 
          ? (email.from[0]?.name || email.from[0]?.email || '').toLowerCase()
          : (email.from || '').toLowerCase()
        const snippet = (email.snippet || '').toLowerCase()
        
        return subject.includes(searchTerm) || 
               from.includes(searchTerm) || 
               snippet.includes(searchTerm)
      })
      .slice(0, 8) // Show top 8 matches
  }, [recentEmails])

  // Load files from Bases when palette opens (only if not cached)
  useEffect(() => {
    if (open && dataManager && basesFiles.length === 0) {
      dataManager.getAllFiles()
        .then(files => {
          setBasesFiles(files)
        })
        .catch(error => {
          console.error('❌ [CommandPalette] Failed to load files from Bases:', error)
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
    if (!commandMode) {
      setFilteredOptions([])
      return
    }

    const query = inputValue.toLowerCase()
    
    switch (commandMode) {
      case 'send_gmail':
        // Show files to select from for Gmail sending
        const filteredGmailFiles = getFilteredFiles(query)
        setFilteredOptions(filteredGmailFiles)
        break
        
      case 'search_emails':
        // Show recent search terms or email previews
        setFilteredOptions([])
        break
        
      case 'save_note':
        // Show emails to save as notes
        const filteredEmails = getFilteredEmails(query)
        setFilteredOptions(filteredEmails)
        break
        
      default:
        setFilteredOptions([])
    }
  }, [commandMode, inputValue, commandParams.file])

  // Real-time command parsing as user types
  React.useEffect(() => {
    // Check for structured commands first
    const structuredMode = detectStructuredCommands(inputValue)
    if (structuredMode && !commandMode) {
      setCommandMode(structuredMode)
      setCommandParams({})
      setInputValue('') // Clear input for parameter entry
      return
    }
    
    // If not in command mode, do regular parsing
    if (!commandMode) {
      const gmailCommand = parseGmailCommand(inputValue)
      const emailNoteCommand = parseEmailNoteCommand(inputValue)
      
      // Prioritize email-note commands over regular Gmail commands
      setParsedCommand(emailNoteCommand || gmailCommand)
    }
  }, [inputValue, commandMode])

  const handleSaveEmailAsNote = async (emailId, options = {}) => {
    try {
      // Get email details first
      const email = recentEmails.find(e => e.id === emailId) || await gmailEmails.getEmailById(emailId)
      if (!email) {
        throw new Error('Email not found')
      }

      // Save email as note
      const filePath = await saveEmailAsNote(email, currentWorkspace?.path, {
        includeHeaders: true,
        includeThreadInfo: true,
        includeAttachments: true,
        subfolder: 'emails',
        ...options
      })

      const fileName = filePath.split('/').pop()
      
      // Return success info for the command history
      return {
        fileName,
        filePath,
        email: {
          subject: email.subject,
          from: email.from,
          id: email.id
        }
      }
    } catch (error) {
      console.error('Failed to save email as note:', error)
      throw new Error(`Failed to save email as note: ${error.message}`)
    }
  }

  const parseEmailNoteCommand = (input) => {
    const trimmedInput = input.trim().toLowerCase()
    
    // Commands for saving emails as notes
    const saveNotePatterns = [
      /^save\s+email\s+(.+?)\s+as\s+note$/i,
      /^email\s+(.+?)\s+to\s+note$/i,
      /^convert\s+email\s+(.+?)\s+to\s+note$/i,
      /^note\s+email\s+(.+?)$/i,
      /^save\s+(.+?)\s+email\s+as\s+note$/i
    ]
    
    for (const pattern of saveNotePatterns) {
      const match = input.match(pattern)
      if (match) {
        const emailIdentifier = match[1].trim()
        
        // Try to find email by subject, sender, or partial content
        const foundEmail = recentEmails.find(email => {
          const subject = email.subject?.toLowerCase() || ''
          const from = (Array.isArray(email.from) ? email.from[0]?.email || email.from[0]?.name : email.from)?.toLowerCase() || ''
          const snippet = email.snippet?.toLowerCase() || ''
          
          return subject.includes(emailIdentifier.toLowerCase()) ||
                 from.includes(emailIdentifier.toLowerCase()) ||
                 snippet.includes(emailIdentifier.toLowerCase())
        })
        
        return {
          type: 'saveAsNote',
          emailIdentifier,
          email: foundEmail,
          confidence: foundEmail ? 0.9 : 0.6,
          originalCommand: input
        }
      }
    }
    
    return null
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (commandMode) {
        // Remove last parameter first, then exit command mode
        const paramKeys = Object.keys(commandParams)
        if (paramKeys.length > 0) {
          // Remove the last parameter
          const newParams = { ...commandParams }
          delete newParams[paramKeys[paramKeys.length - 1]]
          setCommandParams(newParams)
          setInputValue('')
          setFilteredOptions([])
          return
        } else {
          // No parameters left, exit command mode completely
          setCommandMode(null)
          setCommandParams({})
          setInputValue('')
          setFilteredOptions([])
          return
        }
      } else {
        // Not in command mode, close palette
        setInputValue('')
        setFilteredOptions([])
        return
      }
    }

    if (e.key === 'Enter') {
      // Handle structured command mode
      if (commandMode) {
        e.preventDefault()  // Only prevent for command mode

        if (commandMode === 'send_gmail') {
          if (filteredOptions.length > 0) {
            // Send Gmail from first matching file
            const selectedFile = filteredOptions[0]
            runCommandWithHistory(
              () => handleSendGmailFromFile(selectedFile),
              `Send Gmail: ${selectedFile.name}`,
              {
                fileName: selectedFile.name,
                filePath: selectedFile.path,
                originalCommand: `send gmail ${selectedFile.name}`
              }
            )

            // Reset command mode
            setCommandMode(null)
            setCommandParams({})
            setInputValue('')
            return
          }
        } else if (commandMode === 'save_note') {
          if (filteredOptions.length > 0) {
            // Save first matching email as note
            const selectedEmail = filteredOptions[0]
            runCommandWithHistory(
              () => handleSaveEmailAsNote(selectedEmail.id),
              `Save Email as Note: "${selectedEmail.subject || 'No Subject'}"`,
              {
                emailSubject: selectedEmail.subject,
                emailId: selectedEmail.id,
                originalCommand: `save email "${selectedEmail.subject}" as note`
              }
            )

            // Reset command mode
            setCommandMode(null)
            setCommandParams({})
            setInputValue('')
            return
          }
        } else if (commandMode === 'search_emails') {
          if (inputValue.trim()) {
            runCommandWithHistory(
              () => handleGmailSearch(inputValue.trim()),
              `Search Gmail: ${inputValue.trim()}`,
              {
                query: inputValue.trim(),
                originalCommand: `search emails ${inputValue.trim()}`
              }
            )

            // Reset command mode
            setCommandMode(null)
            setCommandParams({})
            setInputValue('')
            return
          }
        }
        return  // Exit if in command mode
      }

      // Handle text-based commands (only if input has text)
      if (inputValue && inputValue.trim()) {
        // Check for email-note commands first
        const emailNoteCommand = parseEmailNoteCommand(inputValue)
        if (emailNoteCommand) {
          e.preventDefault()  // Only prevent if we're handling it

          if (emailNoteCommand.type === 'saveAsNote') {
            if (emailNoteCommand.email) {
              runCommandWithHistory(
                () => handleSaveEmailAsNote(emailNoteCommand.email.id),
                `Save Email as Note: "${emailNoteCommand.email.subject || 'No Subject'}"`,
                {
                  emailSubject: emailNoteCommand.email.subject,
                  emailId: emailNoteCommand.email.id,
                  originalCommand: emailNoteCommand.originalCommand
                }
              )
            }
          }
          setInputValue('')
          return
        }

        // Fallback to regular Gmail commands
        const gmailCommand = parseGmailCommand(inputValue)
        if (gmailCommand) {
          e.preventDefault()  // Only prevent if we're handling it

          if (gmailCommand.type === 'send') {
            const recipients = Array.isArray(gmailCommand.recipients)
              ? gmailCommand.recipients.join(', ')
              : gmailCommand.recipients || gmailCommand.recipient
            const fileName = gmailCommand.fileName || 'content'
            const subject = gmailCommand.subject || `Email from Lokus`

            runCommandWithHistory(
              () => handleSendEmailSmart(gmailCommand),
              `Send Email: ${fileName} → ${recipients}`,
              {
                fileName,
                recipients,
                subject,
                originalCommand: gmailCommand.originalCommand
              }
            )
          } else if (gmailCommand.type === 'search') {
            runCommandWithHistory(
              () => handleGmailSearch(gmailCommand.query),
              `Search Gmail: ${gmailCommand.query}`,
              {
                query: gmailCommand.query,
                originalCommand: gmailCommand.originalCommand
              }
            )
          }
          setInputValue('')
          return
        }
      }

      // If we reach here, we didn't handle the Enter key
      // Let cmdk's built-in handler trigger onSelect for regular command items
      // DON'T call e.preventDefault() - this is the fix!
    }
  }

  const getCommandModePlaceholder = (mode, params) => {
    switch (mode) {
      case 'send_gmail':
        return "Select a file to send via Gmail (type filename to search)"
      case 'search_emails':
        return "Enter search query for emails"
      case 'save_note':
        return "Type to find email to save as note"
      default:
        return "Enter command parameters"
    }
  }

  return (
    <>
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder={
          commandMode 
            ? getCommandModePlaceholder(commandMode, commandParams)
            : "Type command: 'send gmail', 'search emails', 'save email' or direct commands"
        }
        value={inputValue}
        onValueChange={setInputValue}
        onKeyDown={handleInputKeyDown}
      />
      
      {/* Real-time Command Interpretation Display */}
      {parsedCommand && inputValue && (
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50/50 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            {parsedCommand.type === 'send' ? (
              <>
                <Send className="w-4 h-4 text-blue-500" />
                <span>Send email:</span>
                {parsedCommand.fileName && (
                  <>
                    <File className="w-3 h-3" />
                    <span className="font-medium text-blue-600">{parsedCommand.fileName}</span>
                  </>
                )}
                <ArrowRight className="w-3 h-3" />
                <User className="w-3 h-3" />
                <span className="font-medium text-green-600">
                  {Array.isArray(parsedCommand.recipients) 
                    ? parsedCommand.recipients.join(', ')
                    : parsedCommand.recipients || parsedCommand.recipient || 'No recipient detected'
                  }
                </span>
                {parsedCommand.subject && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-700">Subject: "{parsedCommand.subject}"</span>
                  </>
                )}
              </>
            ) : parsedCommand.type === 'saveAsNote' ? (
              <>
                <FileText className="w-4 h-4 text-orange-500" />
                <span>Save email as note:</span>
                {parsedCommand.email ? (
                  <>
                    <Mail className="w-3 h-3" />
                    <span className="font-medium text-orange-600">
                      "{parsedCommand.email.subject || 'No Subject'}"
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">
                      from {Array.isArray(parsedCommand.email.from) 
                        ? (parsedCommand.email.from[0]?.name || parsedCommand.email.from[0]?.email)
                        : parsedCommand.email.from
                      }
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-600">Email not found: "{parsedCommand.emailIdentifier}"</span>
                  </>
                )}
              </>
            ) : parsedCommand.type === 'search' ? (
              <>
                <Search className="w-4 h-4 text-purple-500" />
                <span>Search Gmail for:</span>
                <span className="font-medium text-purple-600">"{parsedCommand.query}"</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 text-gray-500" />
                <span>Gmail command detected</span>
              </>
            )}
          </div>
          {parsedCommand.confidence && parsedCommand.confidence < 0.8 && (
            <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <span>⚠️ Low confidence - please check command details</span>
            </div>
          )}
        </div>
      )}
      
      {/* Command Mode Status */}
      {commandMode && (
        <div className="px-3 py-2 border-b border-blue-200 bg-blue-50/50 text-sm">
          <div className="flex items-center gap-2 text-blue-800">
            {commandMode === 'search_emails' && (
              <>
                <Search className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Email Search Mode</span>
              </>
            )}
            {commandMode === 'send_gmail' && (
              <>
                <Send className="w-4 h-4 text-green-600" />
                <span className="font-medium">Send Gmail Mode</span>
              </>
            )}
            {commandMode === 'save_note' && (
              <>
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="font-medium">Save Email as Note Mode</span>
              </>
            )}
            <span className="text-xs text-blue-600 ml-auto">Press Esc to exit</span>
          </div>
        </div>
      )}
      
      <CommandList>
        <CommandEmpty>
          {commandMode 
            ? `No ${commandMode === 'send_gmail' ? 'files' : commandMode === 'save_note' ? 'emails' : 'results'} found.`
            : 'No results found.'
          }
        </CommandEmpty>
        
        {/* Filtered Options for Command Mode */}
        {commandMode && filteredOptions.length > 0 && (
          <CommandGroup heading={
            commandMode === 'send_gmail' ? 'Choose File to Send' :
            commandMode === 'save_note' ? 'Select Email to Save as Note' :
            'Options'
          }>
            {filteredOptions.map((option, index) => (
              <CommandItem
                key={option.id || option.path || index}
                onSelect={() => {
                  if (commandMode === 'send_gmail') {
                    runCommandWithHistory(
                      () => handleSendGmailFromFile(option), 
                      `Send Gmail: ${option.name}`, 
                      { 
                        fileName: option.name,
                        filePath: option.path,
                        originalCommand: `send gmail ${option.name}`
                      }
                    )
                    setCommandMode(null)
                    setCommandParams({})
                    setInputValue('')
                  } else if (commandMode === 'save_note') {
                    runCommandWithHistory(
                      () => handleSaveEmailAsNote(option.id), 
                      `Save Email as Note: "${option.subject || 'No Subject'}"`, 
                      { 
                        emailSubject: option.subject,
                        emailId: option.id,
                        originalCommand: `save email "${option.subject}" as note`
                      }
                    )
                    setCommandMode(null)
                    setCommandParams({})
                    setInputValue('')
                  }
                }}
                className="group"
              >
                {commandMode === 'send_gmail' ? (
                  <>
                    <File className="mr-2 h-4 w-4 opacity-60" />
                    <span className="flex-1">{option.name}</span>
                    <span className="text-xs text-app-muted">{option.path}</span>
                  </>
                ) : commandMode === 'save_note' ? (
                  <>
                    <Mail className="mr-2 h-4 w-4 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{option.subject || 'No Subject'}</div>
                      <div className="text-xs text-app-muted truncate">
                        from {Array.isArray(option.from) 
                          ? (option.from[0]?.name || option.from[0]?.email)
                          : option.from
                        }
                      </div>
                    </div>
                  </>
                ) : (
                  <span>{option.name || option.subject || 'Unknown'}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
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
          <CommandItem onSelect={() => runCommandWithHistory(onOpenDailyNote, 'Open Daily Note')}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Open Daily Note</span>
            <CommandShortcut>{formatAccelerator(shortcuts['daily-note'])}</CommandShortcut>
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
                <CommandShortcut>S</CommandShortcut>
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
          <CommandItem onSelect={() => runCommandWithHistory(onOpenGraph, 'Open Graph View')}>
            <Network className="mr-2 h-4 w-4" />
            <span>Professional Graph View</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommandWithHistory(onOpenGmail, 'Open Gmail')}>
            <Mail className="mr-2 h-4 w-4" />
            <span>Gmail</span>
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Folder Scope */}
        <CommandGroup heading="Folder Scope">
          <CommandItem onSelect={() => runCommandWithHistory(handleOpenFolderSelector, 'Switch to Local View')}>
            <Target className="mr-2 h-4 w-4" />
            <span>Switch to Local View</span>
            <CommandShortcut>⌘⇧L</CommandShortcut>
          </CommandItem>
          {scopeMode === 'local' && (
            <CommandItem onSelect={() => runCommandWithHistory(setGlobalScope, 'Switch to Global View')}>
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
            } catch (error) {
              console.error('Failed to create base:', error);
            }
          }, 'Create New Base')}>
            <Database className="mr-2 h-4 w-4" />
            <span>Create New Base</span>
            <CommandShortcut>⌘⇧B</CommandShortcut>
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
              <CommandShortcut className="text-xs">{base.description || 'Base'}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        {/* Gmail Commands */}
        <CommandGroup heading="Gmail">
          {!isGmailAuthenticated ? (
            <CommandItem onSelect={() => runCommandWithHistory(async () => {
              try {
                await ensureGmailAuth()
              } catch (error) {
                console.error('Gmail auth failed:', error)
                alert('Gmail authentication failed')
              }
            }, 'Authenticate Gmail')}>
              <Mail className="mr-2 h-4 w-4" />
              <span>Authenticate Gmail</span>
              <CommandShortcut>Auth</CommandShortcut>
            </CommandItem>
          ) : (
            <>
              <CommandItem 
                onSelect={() => runCommandWithHistory(() => handleGmailSearch(''), 'Search Gmail')}
                disabled={!isGmailAuthenticated}
              >
                <Search className="mr-2 h-4 w-4" />
                <span>Search Gmail</span>
                <CommandShortcut>Find</CommandShortcut>
              </CommandItem>

              <CommandItem 
                onSelect={() => {
                  setCommandMode('send_gmail');
                  setCommandParams({});
                  setInputValue('');
                }}
                disabled={!isGmailAuthenticated}
              >
                <Send className="mr-2 h-4 w-4" />
                <span>Send Gmail</span>
                <CommandShortcut>Send</CommandShortcut>
              </CommandItem>
            </>
          )}
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
                        case 'Open Gmail':
                          runCommand(onOpenGmail)
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