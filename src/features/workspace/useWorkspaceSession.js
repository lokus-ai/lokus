import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../../stores/workspace";
import { getMarkdownCompiler } from "../../core/markdown/compiler.js";
import { getFilename } from "../../utils/pathUtils.js";
import { isImageFile, findImageFiles } from "../../utils/imageUtils.js";
import referenceManager from "../../core/references/ReferenceManager.js";

/**
 * Manages session persistence, file tree fetching, and file content loading.
 *
 * @param {object} params
 * @param {string}  params.workspacePath - The active workspace path.
 * @param {object}  params.editorRef     - Ref to the Tiptap editor instance.
 * @param {Array}   params.plugins       - Loaded plugin list (for tab rehydration).
 *
 * @returns {{
 *   reloadCurrentFile:      () => Promise<void>,
 *   handleEditorChange:     (newContent: string) => void,
 *   getTabDisplayName:      (tabPath: string, pluginsList?: Array) => string,
 *   insertImagesIntoEditor: (imagePaths: string[]) => Promise<void>,
 * }}
 */
export function useWorkspaceSession({ workspacePath, editorRef, plugins }) {
  // Store slices consumed by effects — pulled via selectors so effects re-run
  // only when the relevant slice actually changes.
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const expandedFolders = useWorkspaceStore((s) => s.expandedFolders);
  const recentFiles = useWorkspaceStore((s) => s.recentFiles);
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const refreshId = useWorkspaceStore((s) => s.refreshId);

  // -------------------------------------------------------------------------
  // Helper – get proper display name for special tabs
  // -------------------------------------------------------------------------
  const getTabDisplayName = useCallback((tabPath, pluginsList = []) => {
    if (tabPath === '__graph__') return 'Graph View';
    if (tabPath === '__kanban__') return 'Task Board';
    if (tabPath === '__bases__') return 'Bases';
    if (tabPath.startsWith('__plugin_') && tabPath.endsWith('__')) {
      const pluginId = tabPath.slice(9, -2);
      const plugin = pluginsList.find(p => p.id === pluginId || p.name === pluginId);
      return plugin ? plugin.name : 'Plugin';
    }
    return tabPath.split('/').pop();
  }, []);

  // -------------------------------------------------------------------------
  // Session loading on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!workspacePath) return;

    Promise.all([
      invoke("load_session_state", { workspacePath }),
      invoke("validate_workspace_path", { path: workspacePath })
    ]).then(([session]) => {
      if (session && session.open_tabs) {
        useWorkspaceStore.setState({ expandedFolders: new Set(session.expanded_folders || []) });

        const tabsWithNames = session.open_tabs.map(p => ({
          path: p,
          name: getTabDisplayName(p, plugins)
        }));

        useWorkspaceStore.setState({ openTabs: tabsWithNames });

        if (tabsWithNames.length > 0) {
          useWorkspaceStore.setState({ activeFile: tabsWithNames[0].path });
        }

        if (session.recent_files && session.recent_files.length > 0) {
          useWorkspaceStore.setState({
            recentFiles: session.recent_files.slice(0, 5).map(p => ({
              path: p,
              name: getFilename(p)
            }))
          });
        } else {
          const actualFiles = session.open_tabs.filter(p =>
            !p.startsWith('__') &&
            (p.endsWith('.md') || p.endsWith('.txt') || p.endsWith('.canvas') || p.endsWith('.kanban') || p.endsWith('.pdf'))
          );
          useWorkspaceStore.setState({
            recentFiles: actualFiles.slice(0, 5).map(p => ({
              path: p,
              name: getFilename(p)
            }))
          });
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);

  // -------------------------------------------------------------------------
  // Plugin tab rehydration
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (plugins.length === 0 || openTabs.length === 0) return;

    useWorkspaceStore.setState((s) => {
      const prevTabs = s.openTabs;
      const needsUpdate = prevTabs.some(tab =>
        tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin
      );

      if (!needsUpdate) return {};

      return {
        openTabs: prevTabs
          .map(tab => {
            if (tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin) {
              const pluginId = tab.path.slice(9, -2);
              const plugin = plugins.find(p => p.id === pluginId || p.name === pluginId);
              if (plugin) return { ...tab, name: plugin.name, plugin };
            }
            return tab;
          })
          .filter(tab => {
            if (tab.path.startsWith('__plugin_') && tab.path.endsWith('__') && !tab.plugin) return false;
            return true;
          })
      };
    });
  }, [plugins, openTabs]);

  // -------------------------------------------------------------------------
  // Session save (debounced, 500 ms)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (!workspacePath) return;
      const tabPaths = openTabs.map(t => t.path);
      const folderPaths = Array.from(expandedFolders);
      const recentPaths = recentFiles.map(f => f.path);
      invoke("save_session_state", {
        workspacePath,
        openTabs: tabPaths,
        expandedFolders: folderPaths,
        recentFiles: recentPaths,
      });
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [workspacePath, openTabs, expandedFolders, recentFiles]);

  // -------------------------------------------------------------------------
  // File tree fetching
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!workspacePath) return;

    invoke("validate_workspace_path", { path: workspacePath }).catch(() => {});

    try { window.__LOKUS_WORKSPACE_PATH__ = workspacePath; } catch {}

    invoke("read_workspace_files", { workspacePath })
      .then(files => {
        const filterIgnored = (entries) => {
          const ignoredNames = ['.lokus', '.DS_Store'];
          return entries
            .filter(entry => !ignoredNames.includes(entry.name))
            .map(entry => {
              if (entry.children) {
                return { ...entry, children: filterIgnored(entry.children) };
              }
              return entry;
            });
        };

        const tree = filterIgnored(files);
        useWorkspaceStore.getState().setFileTree(tree);

        const flat = [];
        const walk = (arr) => {
          for (const e of arr) {
            if (e.is_directory) { if (e.children) walk(e.children); }
            else flat.push({ title: e.name, path: e.path });
          }
        };
        walk(tree);
        try { window.__LOKUS_FILE_INDEX__ = flat; } catch {}

        referenceManager.init(workspacePath);
        referenceManager.buildIndex(flat).catch(() => {});

        const imageFiles = findImageFiles(tree);
        useWorkspaceStore.getState().setAllImageFiles(imageFiles);
      })
      .catch(() => {});
  }, [workspacePath, refreshId]);

  // -------------------------------------------------------------------------
  // File content loading (runs when activeFile changes)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeFile) {
      try { window.__LOKUS_ACTIVE_FILE__ = activeFile; } catch {}

      if (
        activeFile.startsWith('__') ||
        activeFile.endsWith('.canvas') ||
        activeFile.endsWith('.kanban') ||
        activeFile.endsWith('.pdf') ||
        isImageFile(activeFile)
      ) {
        return;
      }

      useWorkspaceStore.getState().setContent("");
      useWorkspaceStore.getState().setTitle("");
      useWorkspaceStore.getState().setLoading(true);

      const fileToLoad = activeFile;

      invoke("read_file_content", { path: fileToLoad })
        .then(async content => {
          if (fileToLoad !== useWorkspaceStore.getState().activeFile) return;

          const fileName = getFilename(fileToLoad);
          const compiler = getMarkdownCompiler();
          let processedContent = content;

          if (fileToLoad.endsWith('.md') && (await compiler.isMarkdown(content))) {
            processedContent = await compiler.compile(content);
          }

          useWorkspaceStore.getState().setContent(processedContent);
          useWorkspaceStore.getState().setTitle(fileName.replace(/\.md$/, ""));
          useWorkspaceStore.getState().setSavedContent(content);
          useWorkspaceStore.getState().setLoading(false);
        })
        .catch((err) => {
          if (fileToLoad === useWorkspaceStore.getState().activeFile) {
            useWorkspaceStore.getState().setLoading(false);
            useWorkspaceStore.getState().setContent(`<div class="text-red-500 p-4">Failed to load file: ${err}</div>`);
            useWorkspaceStore.getState().setTitle("Error");
          }
        });
    } else {
      useWorkspaceStore.getState().setContent("");
      useWorkspaceStore.getState().setTitle("");
      useWorkspaceStore.getState().setLoading(false);
    }
  }, [activeFile]);

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  const reloadCurrentFile = useCallback(async () => {
    const { activeFile: file, openTabs: tabs } = useWorkspaceStore.getState();
    if (!file) return;

    try {
      const content = await invoke("read_file_content", { path: file });
      const activeTab = tabs.find(tab => tab.path === file);

      if (activeTab) {
        const compiler = getMarkdownCompiler();
        let processedContent = content;

        if (activeTab.name.endsWith('.md') && (await compiler.isMarkdown(content))) {
          processedContent = await compiler.compile(content);
        }

        useWorkspaceStore.getState().setContent(processedContent);
        useWorkspaceStore.getState().setSavedContent(content);

        useWorkspaceStore.setState((s) => {
          const newSet = new Set(s.unsavedChanges);
          newSet.delete(file);
          return { unsavedChanges: newSet };
        });
      }
    } catch {}
  }, []);

  const handleEditorChange = useCallback((newContent) => {
    useWorkspaceStore.getState().setContent(newContent);
    if (!useWorkspaceStore.getState().activeFile) return;
    useWorkspaceStore.setState((s) => {
      const next = new Set(s.unsavedChanges);
      if (newContent !== s.savedContent) {
        next.add(s.activeFile);
      } else {
        next.delete(s.activeFile);
      }
      return { unsavedChanges: next };
    });
  }, []);

  // Insert images into editor at cursor position.
  // Uses WikiLink nodes with pre-resolved data-URL src to avoid race conditions.
  const insertImagesIntoEditor = useCallback(async (imagePaths) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const { readFile } = await import('@tauri-apps/plugin-fs');

    const extToMime = (ext) => {
      const map = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        bmp: 'image/bmp', tiff: 'image/tiff', avif: 'image/avif'
      };
      return map[ext?.toLowerCase()] || 'application/octet-stream';
    };

    for (const imagePath of imagePaths) {
      const fileName = imagePath.split('/').pop();

      let src = '';
      try {
        const data = await readFile(imagePath);
        const ext = fileName.split('.').pop();
        const mime = extToMime(ext);
        let binary = '';
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i]);
        }
        src = `data:${mime};base64,${btoa(binary)}`;
      } catch {
        // src stays empty — image won't render but link will work
      }

      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      editor.chain()
        .focus()
        .insertContent({
          type: 'wikiLink',
          attrs: { id, target: fileName, alt: '', embed: true, href: imagePath, src }
        })
        .run();
    }

    editor.chain().focus().insertContent({ type: 'paragraph' }).run();
  }, [editorRef]);

  return {
    reloadCurrentFile,
    handleEditorChange,
    getTabDisplayName,
    insertImagesIntoEditor,
  };
}
