import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

/**
 * Custom hook for managing editor operations in the Workspace component.
 *
 * Provides handlers for:
 * - File operations (save, save as, export)
 * - Editor formatting (bold, italic, underline, etc.)
 * - Editor editing (undo, redo, cut, copy, paste, select all)
 * - Editor insertions (wikilink, math, tables, images, lists, etc.)
 *
 * @param {Object} params - Hook parameters
 * @param {React.RefObject} params.editorRef - Reference to the TipTap editor instance
 * @param {React.RefObject} params.stateRef - Reference to the current state object
 * @param {React.RefObject} params.lastVersionSaveRef - Reference to track last version save times
 * @param {React.RefObject} params.lastVersionContentRef - Reference to track last saved content versions
 * @param {React.RefObject} params.graphProcessorRef - Reference to the GraphDataProcessor instance
 * @param {Function} params.setSavedContent - State setter for saved content
 * @param {Function} params.setUnsavedChanges - State setter for unsaved changes
 * @param {Function} params.setOpenTabs - State setter for open tabs
 * @param {Function} params.setActiveFile - State setter for active file
 * @param {Function} params.setVersionRefreshKey - State setter for version history refresh trigger
 * @param {Function} params.setGraphData - State setter for graph data
 * @param {Function} params.handleRefreshFiles - Function to refresh the file tree
 * @param {Function} params.setShowWikiLinkModal - State setter for wiki link modal visibility
 * @returns {Object} Object containing all editor operation handlers
 */
export function useEditorOperations({
  editorRef,
  stateRef,
  lastVersionSaveRef,
  lastVersionContentRef,
  graphProcessorRef,
  setSavedContent,
  setUnsavedChanges,
  setOpenTabs,
  setActiveFile,
  setVersionRefreshKey,
  setGraphData,
  handleRefreshFiles,
  setShowWikiLinkModal,
}) {
  /**
   * Parse Gmail template from markdown content with YAML frontmatter
   * @param {string} content - The markdown content to parse
   * @returns {Object|null} Parsed template object or null if not a valid template
   */
  const parseGmailTemplate = (content) => {
    try {
      // Check if content starts with YAML frontmatter
      if (!content.startsWith('---')) {
        return null;
      }

      // Extract frontmatter and body
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd === -1) {
        return null;
      }

      const frontmatterContent = content.slice(3, frontmatterEnd).trim();
      const body = content.slice(frontmatterEnd + 3).trim();

      // Parse the YAML-like frontmatter
      const metadata = {};
      const lines = frontmatterContent.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim().toLowerCase();
          const value = line.slice(colonIndex + 1).trim();
          metadata[key] = value;
        }
      }

      // Check if this looks like a Gmail template
      if (metadata.to !== undefined && metadata.subject !== undefined) {
        return {
          to: metadata.to ? metadata.to.split(',').map(email => email.trim()).filter(email => email) : [],
          cc: metadata.cc ? metadata.cc.split(',').map(email => email.trim()).filter(email => email) : [],
          bcc: metadata.bcc ? metadata.bcc.split(',').map(email => email.trim()).filter(email => email) : [],
          subject: metadata.subject || '',
          body: body.replace(/<!--.*?-->/gs, '').trim() // Remove HTML comments
        };
      }
    } catch (error) {
      console.error('Failed to parse Gmail template:', error);
    }

    return null;
  };

  /**
   * Save the current file
   * Handles file renaming if title changed, version history, and Gmail template detection
   */
  const handleSave = useCallback(async () => {
    const { activeFile, openTabs, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    let path_to_save = activeFile;
    let needsStateUpdate = false;

    try {
      const currentTab = openTabs.find(t => t.path === activeFile);
      const currentName = currentTab.name.replace(/\.md$/, "");

      if (editorTitle !== currentName && editorTitle.trim() !== "") {
        const newFileName = `${editorTitle.trim()}.md`;
        const newPath = await invoke("rename_file", { path: activeFile, newName: newFileName });
        path_to_save = newPath;
        needsStateUpdate = true;
      }

      // For .md files, we need to convert HTML content back to markdown
      let contentToSave = editorContent;
      if (path_to_save.endsWith('.md')) {
        // TODO: Implement HTML to Markdown conversion
        // For now, we'll save the HTML content as-is
        // This should be replaced with proper HTML->Markdown conversion
      }

      await invoke("write_file_content", { path: path_to_save, content: contentToSave });
      setSavedContent(editorContent);
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeFile);
        newSet.delete(path_to_save);
        return newSet;
      });

      // Save version only if content actually changed
      const lastContent = lastVersionContentRef.current[path_to_save];
      const contentChanged = !lastContent || lastContent !== contentToSave;

      if (contentChanged) {
        try {
          await invoke("save_file_version_manual", {
            path: path_to_save,
            content: contentToSave
          });
          const now = Date.now();
          lastVersionSaveRef.current[path_to_save] = now;
          lastVersionContentRef.current[path_to_save] = contentToSave;

          // Refresh version history panel
          setVersionRefreshKey(prev => prev + 1);

          console.log("[Version] Saved version for", path_to_save);
        } catch (error) {
          console.warn("[Version] Failed to save version:", error);
          // Non-blocking - don't show error to user
        }
      } else {
        console.log("[Version] Skipped - content unchanged");
      }

      // Check if this is a Gmail template and send email
      const gmailTemplate = parseGmailTemplate(contentToSave);
      if (gmailTemplate) {
        try {
          // Import Gmail services dynamically
          const { gmailAuth, gmailEmails } = await import('../../services/gmail.js');

          // Check if user is authenticated with Gmail
          const isAuthenticated = await gmailAuth.isAuthenticated();
          if (isAuthenticated && gmailTemplate.to.length > 0 && gmailTemplate.subject) {
            // Send the email
            await gmailEmails.sendEmail({
              to: gmailTemplate.to,
              cc: gmailTemplate.cc,
              bcc: gmailTemplate.bcc,
              subject: gmailTemplate.subject,
              body: gmailTemplate.body,
              attachments: [] // For future implementation
            });
          } else if (!isAuthenticated) {
            console.log('[Gmail] User not authenticated, skipping email send');
          }
        } catch (emailError) {
          console.error('[Gmail] Failed to send email:', emailError);
        }
      }

      if (needsStateUpdate) {
        const newName = path_to_save.split("/").pop();
        setOpenTabs(tabs => tabs.map(t => t.path === activeFile ? { path: path_to_save, name: newName } : t));
        setActiveFile(path_to_save);
        handleRefreshFiles();
      } else {
        // File content changed but not renamed - use real-time link tracking
        if (graphProcessorRef.current) {
          try {
            // Use the new real-time update method for file content
            const updateResult = await graphProcessorRef.current.updateFileContent(path_to_save, editorContent);

            // Only rebuild graph structure if there were actual changes
            if (updateResult.added > 0 || updateResult.removed > 0) {
              const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
              setGraphData(updatedGraphData);
            }
          } catch (error) {
            // Fallback to full selective update
            try {
              const updatedGraphData = await graphProcessorRef.current.updateChangedFiles([path_to_save]);
              if (updatedGraphData) {
                setGraphData(updatedGraphData);
              }
            } catch (fallbackError) {
              // Final fallback to full refresh
              handleRefreshFiles();
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [
    stateRef,
    lastVersionSaveRef,
    lastVersionContentRef,
    graphProcessorRef,
    setSavedContent,
    setUnsavedChanges,
    setOpenTabs,
    setActiveFile,
    setVersionRefreshKey,
    setGraphData,
    handleRefreshFiles
  ]);

  /**
   * Save the current file with a new name and format
   * Supports multiple export formats: markdown, HTML, text, JSON
   */
  const handleSaveAs = useCallback(async () => {
    const { activeFile, editorContent } = stateRef.current;
    if (!activeFile) return;

    try {
      // Get the current file name without extension for default name
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');

      // Show save dialog with more format options
      const filePath = await save({
        defaultPath: `${currentFileName}.md`,
        filters: [{
          name: 'Markdown',
          extensions: ['md']
        }, {
          name: 'HTML',
          extensions: ['html']
        }, {
          name: 'Text',
          extensions: ['txt']
        }, {
          name: 'JSON',
          extensions: ['json']
        }, {
          name: 'All Files',
          extensions: ['*']
        }],
        title: 'Save As'
      });

      if (filePath) {
        // Prepare content - handle different file types
        let contentToSave = editorContent;

        if (filePath.endsWith('.html')) {
          // For HTML files, wrap content in a complete HTML document
          const { editorTitle } = stateRef.current;
          const title = editorTitle || currentFileName;
          contentToSave = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
        }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
    </style>
</head>
<body>
    ${editorContent}
</body>
</html>`;
        } else if (filePath.endsWith('.json')) {
          // For JSON files, create a structured export
          const { editorTitle } = stateRef.current;
          contentToSave = JSON.stringify({
            title: editorTitle || currentFileName,
            content: editorContent,
            exported: new Date().toISOString(),
            format: 'html'
          }, null, 2);
        } else if (filePath.endsWith('.txt')) {
          // For text files, strip HTML tags
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = editorContent;
          contentToSave = tempDiv.textContent || tempDiv.innerText || '';
        }

        // Save the file
        await invoke("write_file_content", { path: filePath, content: contentToSave });

        // Update current file state to point to new location
        const newFileName = filePath.split('/').pop();
        setOpenTabs(tabs => tabs.map(t => t.path === activeFile ? { path: filePath, name: newFileName } : t));
        setActiveFile(filePath);
        setSavedContent(editorContent);
        setUnsavedChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(activeFile);
          newSet.delete(filePath);
          return newSet;
        });

        // Refresh file tree to show new file
        handleRefreshFiles();
      }
    } catch (error) {
      console.error('Failed to save as:', error);
    }
  }, [stateRef, setSavedContent, setUnsavedChanges, setOpenTabs, setActiveFile, handleRefreshFiles]);

  /**
   * Export the current file as an HTML document with styling
   */
  const handleExportHtml = useCallback(async () => {
    const { activeFile, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    try {
      // Get the current file name without extension for default name
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');
      const exportFileName = editorTitle.trim() || currentFileName;

      // Show save dialog for HTML export
      const filePath = await save({
        defaultPath: `${exportFileName}.html`,
        filters: [{
          name: 'HTML',
          extensions: ['html']
        }, {
          name: 'All Files',
          extensions: ['*']
        }],
        title: 'Export as HTML'
      });

      if (filePath) {
        // Create a complete HTML document with proper styling and math support
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${exportFileName}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2em;
            margin-bottom: 0.5em;
        }
        h1 { font-size: 2.5em; border-bottom: 2px solid #3498db; padding-bottom: 0.3em; }
        h2 { font-size: 2em; }
        h3 { font-size: 1.5em; }
        p { margin-bottom: 1em; }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 1.5em 0;
            color: #7f8c8d;
            font-style: italic;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
        }
        pre {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #e1e5e9;
        }
        pre code {
            background: none;
            padding: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5em 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        ul, ol { margin-bottom: 1em; }
        li { margin-bottom: 0.5em; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .math-display { text-align: center; margin: 1.5em 0; }
        .highlight { background: #fff3cd; padding: 2px 4px; }
        .task-list-item { list-style-type: none; }
        .task-list-item input[type="checkbox"] { margin-right: 8px; }
    </style>
</head>
<body>
    <article class="content">
        ${editorContent}
    </article>
</body>
</html>`;

        // Save the HTML file
        await invoke("write_file_content", { path: filePath, content: htmlContent });
      }
    } catch (error) {
      console.error('Failed to export HTML:', error);
    }
  }, [stateRef]);

  /**
   * Export the current file as a PDF using browser print functionality
   */
  const handleExportPdf = useCallback(async () => {
    const { activeFile, editorContent, editorTitle } = stateRef.current;
    if (!activeFile) return;

    try {
      // Get the current file name without extension for default name
      const currentFileName = activeFile.split('/').pop().replace(/\.[^.]*$/, '');
      const exportFileName = editorTitle.trim() || currentFileName;

      // Show save dialog for PDF export
      const filePath = await save({
        defaultPath: `${exportFileName}.pdf`,
        filters: [{
          name: 'PDF',
          extensions: ['pdf']
        }, {
          name: 'All Files',
          extensions: ['*']
        }],
        title: 'Export as PDF'
      });

      if (filePath) {
        // Create HTML content for PDF conversion
        const htmlForPdf = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${exportFileName}</title>
    <style>
        @page {
            margin: 1in;
            size: letter;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 14px;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            break-after: avoid;
        }
        h1 {
            font-size: 24px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 0.3em;
            page-break-after: avoid;
        }
        h2 { font-size: 20px; }
        h3 { font-size: 18px; }
        h4 { font-size: 16px; }
        h5 { font-size: 14px; }
        h6 { font-size: 12px; }
        p {
            margin-bottom: 1em;
            orphans: 3;
            widows: 3;
        }
        blockquote {
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 1em 0;
            color: #7f8c8d;
            font-style: italic;
            break-inside: avoid;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 12px;
            break-inside: avoid;
        }
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e1e5e9;
            break-inside: avoid;
            font-size: 12px;
            line-height: 1.4;
            overflow-x: hidden;
        }
        pre code {
            background: none;
            padding: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            break-inside: avoid;
            font-size: 12px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        ul, ol {
            margin-bottom: 1em;
            break-inside: avoid;
        }
        li {
            margin-bottom: 0.3em;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
        .math-display {
            text-align: center;
            margin: 1em 0;
            break-inside: avoid;
        }
        .highlight {
            background: #fff3cd;
            padding: 2px 4px;
        }
        .task-list-item {
            list-style-type: none;
        }
        .task-list-item input[type="checkbox"] {
            margin-right: 8px;
        }
        .page-break {
            page-break-before: always;
        }
        img {
            max-width: 100%;
            height: auto;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <article class="content">
        ${editorContent}
    </article>
</body>
</html>`;

        // Create a hidden iframe for PDF generation
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        // Write content to iframe
        iframe.contentDocument.write(htmlForPdf);
        iframe.contentDocument.close();

        // Wait for content to load
        await new Promise(resolve => {
          iframe.onload = resolve;
          setTimeout(resolve, 500);
        });

        // Use browser print dialog to save as PDF
        iframe.contentWindow.print();

        // Cleanup after a delay
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  }, [stateRef]);

  /**
   * Handle editor formatting operations
   * @param {string} formatType - Type of formatting to apply (bold, italic, underline, etc.)
   */
  const handleEditorFormat = useCallback((formatType) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    switch (formatType) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strikethrough':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'code':
        editor.chain().focus().toggleCode().run();
        break;
      case 'highlight':
        editor.chain().focus().toggleHighlight().run();
        break;
      case 'superscript':
        editor.chain().focus().toggleSuperscript().run();
        break;
      case 'subscript':
        editor.chain().focus().toggleSubscript().run();
        break;
      case 'clear-formatting':
        editor.chain().focus().unsetAllMarks().run();
        break;
      default:
        console.warn(`Unknown format type: ${formatType}`);
    }
  }, [editorRef]);

  /**
   * Handle editor edit operations
   * @param {string} action - Edit action to perform (undo, redo, cut, copy, paste, select-all)
   */
  const handleEditorEdit = useCallback((action) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    switch (action) {
      case 'undo':
        editor.chain().focus().undo().run();
        break;
      case 'redo':
        editor.chain().focus().redo().run();
        break;
      case 'cut':
        document.execCommand('cut');
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'paste':
        document.execCommand('paste');
        break;
      case 'select-all':
        editor.chain().focus().selectAll().run();
        break;
      default:
        console.warn(`Unknown edit action: ${action}`);
    }
  }, [editorRef]);

  /**
   * Handle editor insert operations
   * @param {string} insertType - Type of content to insert (wikilink, math, table, image, etc.)
   * @param {Object} options - Additional options for the insert operation
   */
  const handleEditorInsert = useCallback((insertType, options = {}) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    switch (insertType) {
      case 'wikilink':
        setShowWikiLinkModal(true);
        break;
      case 'math-inline':
        editor.chain().focus().insertContent('$  $').setTextSelection(editor.state.selection.from - 2).run();
        break;
      case 'math-block':
        editor.chain().focus().insertContent('\n$$\n\n$$\n').setTextSelection(editor.state.selection.from - 4).run();
        break;
      case 'table':
        if (editor.commands.insertTable) {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
        break;
      case 'image':
        const imageUrl = prompt('Enter image URL:');
        if (imageUrl) {
          editor.chain().focus().setImage({ src: imageUrl }).run();
        }
        break;
      case 'code-block':
        editor.chain().focus().setCodeBlock().run();
        break;
      case 'horizontal-rule':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'bullet-list':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'ordered-list':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'task-list':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'heading':
        if (options.level && editor.commands.setHeading) {
          editor.chain().focus().setHeading({ level: options.level }).run();
        }
        break;
      default:
        console.warn(`Unknown insert type: ${insertType}`);
    }
  }, [editorRef, setShowWikiLinkModal]);

  return {
    handleSave,
    handleSaveAs,
    handleExportHtml,
    handleExportPdf,
    handleEditorFormat,
    handleEditorEdit,
    handleEditorInsert,
  };
}
