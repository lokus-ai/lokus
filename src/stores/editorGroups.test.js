import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditorGroupStore } from './editorGroups';
import { useTabMetaStore, getTabMeta } from './tabMeta';

const TAB = { path: '/ws/note.md', name: 'note.md' };

describe('editorGroups ↔ tabMeta delegation', () => {
  beforeEach(() => {
    useEditorGroupStore.getState().initLayout([TAB], TAB.path);
  });

  it('markTabDirty never rebuilds layout — 100 simulated per-keystroke calls', () => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    const layoutRef = useEditorGroupStore.getState().layout;
    const listener = vi.fn();
    const unsub = useEditorGroupStore.subscribe(listener);

    for (let i = 0; i < 100; i++) {
      useEditorGroupStore.getState().markTabDirty(groupId, TAB.path, true);
    }

    // Layout root reference is unchanged and the store never notified.
    expect(useEditorGroupStore.getState().layout).toBe(layoutRef);
    expect(listener).not.toHaveBeenCalled();
    // ...while the dirty flag landed in tabMeta.
    expect(getTabMeta(groupId, TAB.path)?.dirty).toBe(true);
    unsub();
  });

  it('markTabDirty only reaches tabMeta subscribers on transitions', () => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    const listener = vi.fn();
    const unsub = useTabMetaStore.subscribe(listener);

    useEditorGroupStore.getState().markTabDirty(groupId, TAB.path, true);
    useEditorGroupStore.getState().markTabDirty(groupId, TAB.path, true);
    expect(listener).toHaveBeenCalledTimes(1);

    useEditorGroupStore.getState().markTabDirty(groupId, TAB.path, false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('setTabContent routes metadata to tabMeta without touching layout', () => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    const layoutRef = useEditorGroupStore.getState().layout;

    useEditorGroupStore.getState().setTabContent(groupId, TAB.path, {
      savedContent: 'raw',
      title: 'Note',
      dirty: true,
    });

    expect(useEditorGroupStore.getState().layout).toBe(layoutRef);
    const meta = getTabMeta(groupId, TAB.path);
    expect(meta.savedContent).toBe('raw');
    expect(meta.title).toBe('Note');
    expect(meta.dirty).toBe(true);
  });

  it('setTabContent keeps non-metadata fields in the group content cache', () => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;

    useEditorGroupStore.getState().setTabContent(groupId, TAB.path, { rawMarkdown: '# raw' });

    const group = useEditorGroupStore.getState().findGroup(groupId);
    expect(group.contentByTab[TAB.path]?.rawMarkdown).toBe('# raw');
    // Cache fields do not leak into tabMeta.
    expect(getTabMeta(groupId, TAB.path)?.rawMarkdown).toBeUndefined();
  });

  it('removeTab drops the tabMeta entry; updateTabPath re-keys it', () => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    useEditorGroupStore.getState().setTabContent(groupId, TAB.path, { title: 'Note', dirty: true });

    useEditorGroupStore.getState().updateTabPath(TAB.path, '/ws/renamed.md');
    expect(getTabMeta(groupId, TAB.path)).toBeNull();
    expect(getTabMeta(groupId, '/ws/renamed.md')?.title).toBe('Note');

    useEditorGroupStore.getState().removeTab(groupId, '/ws/renamed.md');
    expect(getTabMeta(groupId, '/ws/renamed.md')).toBeNull();
  });

  it('closeGroup clears the group\'s tabMeta entries', () => {
    // Split so closing the group is meaningful.
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    useEditorGroupStore.getState().splitGroup(groupId, 'vertical', 'after', TAB);
    const newGroupId = useEditorGroupStore.getState().focusedGroupId;
    useEditorGroupStore.getState().setTabContent(newGroupId, TAB.path, { dirty: true });

    useEditorGroupStore.getState().closeGroup(newGroupId);
    expect(getTabMeta(newGroupId, TAB.path)).toBeNull();
  });

  it('initLayout clears all tabMeta entries', () => {
    const groupId = useEditorGroupStore.getState().focusedGroupId;
    useEditorGroupStore.getState().setTabContent(groupId, TAB.path, { dirty: true });

    useEditorGroupStore.getState().initLayout([], null);
    expect(Object.keys(useTabMetaStore.getState().tabs)).toHaveLength(0);
  });

  it('moveTab carries metadata to the target group (dirty survives cross-pane moves)', () => {
    const fromGroupId = useEditorGroupStore.getState().focusedGroupId;
    useEditorGroupStore.getState().setTabContent(fromGroupId, TAB.path, { title: 'Note', dirty: true });
    useEditorGroupStore.getState().splitGroup(fromGroupId, 'vertical');
    const toGroupId = useEditorGroupStore.getState().focusedGroupId;

    useEditorGroupStore.getState().moveTab(fromGroupId, toGroupId, TAB.path);

    expect(getTabMeta(fromGroupId, TAB.path)).toBeNull();
    const meta = getTabMeta(toGroupId, TAB.path);
    expect(meta?.dirty).toBe(true);
    expect(meta?.title).toBe('Note');
  });
});
