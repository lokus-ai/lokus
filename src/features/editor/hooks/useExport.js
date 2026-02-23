import { useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import posthog from '../../../services/posthog.js';

export function useExport({ workspacePath }) {
  const handleExportHtml = useCallback(async () => {
    const { activeFile, editorContent, editorTitle } = useWorkspaceStore.getState();
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
      posthog.trackError('export_failed', 'workspace', true);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    const { activeFile, editorContent, editorTitle } = useWorkspaceStore.getState();
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
      posthog.trackError('export_failed', 'workspace', true);
    }
  }, []);

  return { handleExportHtml, handleExportPdf };
}
