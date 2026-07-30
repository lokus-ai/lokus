import React from 'react';
import { useEditorGroupStore } from '../../stores/editorGroups';
import EditorGroupsContainer from '../../components/EditorGroupsContainer';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * EditorGroupsView — renders the editor groups tree layout.
 * This is the "editor" view in the MainContent view router.
 */
export default function EditorGroupsView({ workspacePath, welcomeProps }) {
  const layout = useEditorGroupStore((s) => s.layout);
  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);

  // Single group = layout root is a 'group' node (not a 'container' with children)
  const isSingleGroup = layout.type === 'group';

  // Always hand the container a 'container' root. When the store root is a
  // bare group, splitting used to change the root node type (group→container),
  // which changed the React tree shape and REMOUNTED every EditorGroup —
  // destroying the persistent EditorView, undo history, and cursor. Wrapping
  // the single group in a synthetic container keeps the tree shape stable, so
  // the first split (and collapsing back to one group) never remounts panes.
  const rootNode = isSingleGroup
    ? { id: '__layout_root__', type: 'container', direction: 'vertical', children: [layout], sizes: [100] }
    : layout;

  return (
    <div className="flex-1 h-full overflow-hidden">
      <ErrorBoundary name="EditorGroups" message="Editor groups crashed">
        <EditorGroupsContainer
          node={rootNode}
          workspacePath={workspacePath}
          isSingleGroup={isSingleGroup}
          welcomeProps={welcomeProps}
        />
      </ErrorBoundary>
    </div>
  );
}
