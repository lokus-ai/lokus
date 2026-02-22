import { useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { invoke } from '@tauri-apps/api/core';
import { getMarkdownCompiler } from '../../../core/markdown/compiler';

export function useEditorContent({ workspacePath }) {
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const setContent = useWorkspaceStore((s) => s.setContent);
  const setSavedContent = useWorkspaceStore((s) => s.setSavedContent);
  const setTitle = useWorkspaceStore((s) => s.setTitle);
  const setLoading = useWorkspaceStore((s) => s.setLoading);

  // Load file content when activeFile changes
  useEffect(() => {
    if (!activeFile || activeFile.startsWith('__')) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const content = await invoke('read_file_content', { path: activeFile });
        if (cancelled) return;

        let html = content;
        if (activeFile.endsWith('.md')) {
          const compiler = getMarkdownCompiler();
          html = compiler.compile(content);
        }
        setContent(html);
        setSavedContent(html);
        setTitle(activeFile.split('/').pop().replace(/\.md$/, ''));
      } catch (e) {
        console.error('Failed to load file:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeFile, workspacePath, setContent, setSavedContent, setTitle, setLoading]);

  const handleEditorChange = useCallback((newContent) => {
    const store = useWorkspaceStore.getState();
    store.setContent(newContent);
    if (!store.activeFile) return;
    if (newContent !== store.savedContent) {
      store.markUnsaved(store.activeFile);
    } else {
      store.markSaved(store.activeFile);
    }
  }, []);

  return { handleEditorChange };
}
