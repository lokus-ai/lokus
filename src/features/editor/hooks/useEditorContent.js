import { useCallback, useEffect } from 'react';
import { useEditorGroupStore } from '../../../stores/editorGroups';
import { invoke } from '@tauri-apps/api/core';
import { getMarkdownCompiler } from '../../../core/markdown/compiler';

export function useEditorContent({ workspacePath }) {
  // Derive the active file from the focused group in the editor group store
  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);
  const layout = useEditorGroupStore((s) => s.layout);

  // Resolve the focused group's activeTab reactively
  const getFocusedGroup = useEditorGroupStore((s) => s.getFocusedGroup);
  const focusedGroup = getFocusedGroup();
  const activeFile = focusedGroup?.activeTab ?? null;

  const setTabContent = useEditorGroupStore((s) => s.setTabContent);
  const markTabDirty = useEditorGroupStore((s) => s.markTabDirty);

  // Load file content when activeFile or focusedGroupId changes
  useEffect(() => {
    if (!activeFile || activeFile.startsWith('__')) return;
    if (!focusedGroupId) return;

    let cancelled = false;

    // Signal loading via tab content
    setTabContent(focusedGroupId, activeFile, { loading: true });

    (async () => {
      try {
        const content = await invoke('read_file_content', { path: activeFile });
        if (cancelled) return;

        let html = content;
        if (activeFile.endsWith('.md')) {
          const compiler = getMarkdownCompiler();
          html = compiler.compile(content);
        }

        setTabContent(focusedGroupId, activeFile, {
          html,
          savedContent: html,
          title: activeFile.split('/').pop().replace(/\.md$/, ''),
          loading: false,
        });
      } catch (e) {
        console.error('Failed to load file:', e);
        if (!cancelled) {
          setTabContent(focusedGroupId, activeFile, { loading: false });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeFile, focusedGroupId, workspacePath, setTabContent]);

  const handleEditorChange = useCallback((newContent) => {
    const store = useEditorGroupStore.getState();
    const group = store.getFocusedGroup();
    if (!group || !group.activeTab) return;

    const { id: groupId, activeTab: tabPath, contentByTab } = group;
    const savedContent = contentByTab?.[tabPath]?.savedContent ?? null;

    setTabContent(groupId, tabPath, { html: newContent });

    if (savedContent !== null) {
      markTabDirty(groupId, tabPath, newContent !== savedContent);
    }
  }, [setTabContent, markTabDirty]);

  return { handleEditorChange };
}
