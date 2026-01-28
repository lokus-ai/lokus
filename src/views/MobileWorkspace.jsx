/**
 * Mobile Workspace - Simplified workspace view for iOS/Android
 * Avoids desktop-only imports that cause issues on mobile
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import Editor from "../editor";
import { WorkspaceManager } from "../core/workspace/manager.js";
import { getFilename, joinPath } from '../utils/pathUtils.js';
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { ColoredFileIcon } from "../components/FileIcon.jsx";
import { useTheme } from "../hooks/theme.jsx";
import { setGlobalActiveTheme, getSystemPreferredTheme, setupSystemThemeListener } from "../core/theme/manager.js";
import { Toaster } from "../components/ui/sonner";
import { toast } from "../components/ui/enhanced-toast";

console.log('[MobileWorkspace] Module loading...');

export default function MobileWorkspace({ initialPath }) {
  console.log('[MobileWorkspace] Component rendering, initialPath:', initialPath);

  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFileList, setShowFileList] = useState(true);

  const { theme, setTheme } = useTheme();
  const editorRef = useRef(null);

  // Initialize theme
  useEffect(() => {
    const initTheme = async () => {
      try {
        const systemTheme = getSystemPreferredTheme();
        await setGlobalActiveTheme(systemTheme);
        setupSystemThemeListener();
      } catch (e) {
        console.warn('[MobileWorkspace] Theme init error:', e);
      }
    };
    initTheme();
  }, []);

  // Load workspace files
  useEffect(() => {
    const loadFiles = async () => {
      console.log('[MobileWorkspace] Loading files from:', initialPath);
      setIsLoading(true);
      setError(null);

      try {
        // First check if directory exists, create if it doesn't
        const { exists, mkdir } = await import("@tauri-apps/plugin-fs");
        const pathExists = await exists(initialPath);

        if (!pathExists) {
          console.log('[MobileWorkspace] Directory does not exist, creating:', initialPath);
          try {
            await mkdir(initialPath, { recursive: true });
            console.log('[MobileWorkspace] Directory created successfully');
          } catch (mkdirError) {
            console.error('[MobileWorkspace] Failed to create directory:', mkdirError);
            // Directory creation failed - redirect to launcher
            setError('Workspace directory could not be created. Please create a new workspace.');
            setIsLoading(false);
            return;
          }
        }

        const result = await invoke('read_workspace_files', {
          workspacePath: initialPath
        });
        console.log('[MobileWorkspace] Files loaded:', result?.length || 0);

        // Filter to only markdown files for now
        const mdFiles = (result || []).filter(f =>
          f.name?.endsWith('.md') && !f.is_dir
        );
        setFiles(mdFiles);

        // Auto-open first file
        if (mdFiles.length > 0 && !activeFile) {
          handleFileSelect(mdFiles[0]);
        }
      } catch (e) {
        console.error('[MobileWorkspace] Error loading files:', e);
        setError(e.message || 'Failed to load files');
      } finally {
        setIsLoading(false);
      }
    };

    if (initialPath) {
      loadFiles();
    }
  }, [initialPath]);

  const handleFileSelect = async (file) => {
    console.log('[MobileWorkspace] Opening file:', file.name);
    setActiveFile(file);
    setShowFileList(false);

    try {
      const content = await invoke('read_file_content', {
        filePath: file.path
      });
      setFileContent(content || '');
    } catch (e) {
      console.error('[MobileWorkspace] Error reading file:', e);
      toast.error('Failed to open file');
    }
  };

  const handleSave = async () => {
    if (!activeFile) return;

    try {
      const content = editorRef.current?.getContent?.() || fileContent;
      await invoke('write_file_content', {
        filePath: activeFile.path,
        content
      });
      toast.success('Saved');
    } catch (e) {
      console.error('[MobileWorkspace] Error saving:', e);
      toast.error('Failed to save');
    }
  };

  const handleBack = () => {
    setShowFileList(true);
    setActiveFile(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-app-bg text-app-text">
        <div className="animate-pulse text-xl">Loading workspace...</div>
      </div>
    );
  }

  if (error) {
    const handleGoToLauncher = () => {
      // Clear URL params and reload to show launcher
      const url = new URL(window.location);
      url.searchParams.delete('workspacePath');
      window.history.replaceState({}, '', url.toString());
      window.location.reload();
    };

    return (
      <div className="flex items-center justify-center h-screen bg-app-bg text-app-text">
        <div className="text-center p-4">
          <div className="text-red-500 mb-2">Error loading workspace</div>
          <div className="text-sm text-app-muted mb-4">{error}</div>
          <button
            onClick={handleGoToLauncher}
            className="px-4 py-2 bg-app-accent text-white rounded-lg"
          >
            Go to Launcher
          </button>
        </div>
      </div>
    );
  }

  // File list view
  if (showFileList) {
    return (
      <div className="flex flex-col h-screen bg-app-bg text-app-text">
        <div className="p-4 border-b border-app-border">
          <h1 className="text-xl font-semibold">Files</h1>
          <p className="text-sm text-app-muted">{files.length} notes</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {files.map((file, index) => (
            <button
              key={file.path || index}
              onClick={() => handleFileSelect(file)}
              className="w-full p-4 flex items-center gap-3 border-b border-app-border hover:bg-app-hover active:bg-app-active text-left"
            >
              <ColoredFileIcon filename={file.name} size={20} />
              <span className="flex-1 truncate">{file.name}</span>
            </button>
          ))}

          {files.length === 0 && (
            <div className="p-8 text-center text-app-muted">
              No markdown files found
            </div>
          )}
        </div>

        <MobileBottomNav />
        <Toaster />
      </div>
    );
  }

  // Editor view
  return (
    <div className="flex flex-col h-screen bg-app-bg text-app-text">
      {/* Header */}
      <div className="flex items-center p-3 border-b border-app-border gap-2">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-app-hover"
        >
          ← Back
        </button>
        <span className="flex-1 truncate font-medium">
          {activeFile?.name || 'Untitled'}
        </span>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-app-accent text-white rounded-lg"
        >
          Save
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          ref={editorRef}
          initialContent={fileContent}
          filePath={activeFile?.path}
          onChange={(content) => setFileContent(content)}
          onEditorReady={(editor) => {
            console.log('[MobileWorkspace] Editor ready');
            editorRef.current = editor;
          }}
        />
      </div>

      <MobileBottomNav />
      <Toaster />
    </div>
  );
}
