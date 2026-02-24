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

  return (
    <div className="flex-1 h-full overflow-hidden">
      <ErrorBoundary name="EditorGroups" message="Editor groups crashed">
        <EditorGroupsContainer
          node={layout}
          workspacePath={workspacePath}
          isSingleGroup={isSingleGroup}
          welcomeProps={welcomeProps}
        />
      </ErrorBoundary>
    </div>
  );
}
