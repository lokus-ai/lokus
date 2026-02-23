import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorGroupStore } from "../../stores/editorGroups";
import { useFileTreeStore } from "../../stores/fileTree";
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
 *   getTabDisplayName:      (tabPath: string, pluginsList?: Array) => string,
 *   insertImagesIntoEditor: (imagePaths: string[]) => Promise<void>,
 * }}
 */
export function useWorkspaceSession({ workspacePath, editorRef, plugins }) {
  const refreshId = useFileTreeStore((s) => s.refreshId);

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
      if (!session) return;

      // Restore expanded folders into fileTree store
      if (session.expanded_folders) {
        useFileTreeStore.setState({ expandedFolders: new Set(session.expanded_folders) });
      }

      // Restore editor layout if available (new format)
      if (session.editor_layout) {
        useEditorGroupStore.getState().restoreLayout(session.editor_layout);
      } else if (session.open_tabs && session.open_tabs.length > 0) {
        // Legacy: build single group from open_tabs
        const tabs = session.open_tabs.map(p => ({
          path: p,
          name: getTabDisplayName(p, plugins)
        }));
        useEditorGroupStore.getState().initLayout(tabs, tabs[0]?.path || null);
      }

      // Restore recent files
      if (session.recent_files && session.recent_files.length > 0) {
        session.recent_files.slice(0, 5).forEach(p => {
          useEditorGroupStore.getState().addRecentFile(p);
        });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);

  // -------------------------------------------------------------------------
  // Session save (debounced, 500 ms)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (!workspacePath) return;

      const { layout, getAllGroups, globalRecentFiles } = useEditorGroupStore.getState();
      const { expandedFolders } = useFileTreeStore.getState();

      // Collect all open tab paths from all groups for backward compatibility
      const allGroups = getAllGroups();
      const tabPaths = allGroups.flatMap(g => g.tabs.map(t => t.path));
      const folderPaths = Array.from(expandedFolders);
      const recentPaths = globalRecentFiles.slice(0, 5);

      invoke("save_session_state", {
        workspacePath,
        openTabs: tabPaths,
        expandedFolders: folderPaths,
        recentFiles: recentPaths,
        editorLayout: layout,
      });
    }, 500);
    return () => clearTimeout(saveTimeout);
  }, [workspacePath]);

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
        useFileTreeStore.getState().setFileTree(tree);

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
        useEditorGroupStore.getState().setAllImageFiles(imageFiles);
      })
      .catch(() => {});
  }, [workspacePath, refreshId]);

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  const reloadCurrentFile = useCallback(async () => {
    const group = useEditorGroupStore.getState().getFocusedGroup();
    if (!group?.activeTab) return;
    const file = group.activeTab;

    try {
      const content = await invoke("read_file_content", { path: file });
      // Store raw markdown in the group's content cache — the EditorGroup
      // component will pick this up and set it into the TipTap editor.
      useEditorGroupStore.getState().setTabContent(group.id, file, {
        rawMarkdown: content,
        dirty: false,
      });
    } catch {}
  }, []);

  // Insert images into editor at cursor position.
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
    getTabDisplayName,
    insertImagesIntoEditor,
  };
}
