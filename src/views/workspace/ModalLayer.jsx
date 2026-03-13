import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useLayoutStore } from '../../stores/layout';
import { useFileTreeStore } from '../../stores/fileTree';
import { getEditor } from '../../stores/editorRegistry';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import CommandPalette from '../../components/CommandPalette.jsx';
import InFileSearch from '../../components/InFileSearch.jsx';
import FullTextSearchPanel from '../FullTextSearchPanel.jsx';
import ShortcutHelpModal from '../../components/ShortcutHelpModal.jsx';
import TemplatePicker from '../../components/TemplatePicker.jsx';
import CreateTemplate from '../../components/CreateTemplate.jsx';
import TagManagementModal from '../../components/TagManagementModal.jsx';
import AboutDialog from '../../components/AboutDialog.jsx';
import ReferenceUpdateModal from '../../components/ReferenceUpdateModal.jsx';
import CanvasPreviewPopup from '../../components/CanvasPreviewPopup.jsx';
import GraphPreviewPopup from '../../components/GraphPreviewPopup.jsx';
import { DatePickerModal } from '../../components/DailyNotes/index.js';
import { getMarkdownCompiler } from '../../core/markdown/compiler.js';
import { getFilename } from '../../utils/pathUtils.js';
import { insertContent, setTextSelection, insertText } from '../../editor/commands/index.js';

/**
 * Inserts template content into the editor (PM EditorView), handling the {{cursor}} placeholder.
 */
function insertTemplateContent(view, content) {
  const cursorIndex = content.indexOf('{{cursor}}');
  if (cursorIndex !== -1) {
    const beforeCursor = content.substring(0, cursorIndex);
    const afterCursor = content.substring(cursorIndex + 10);
    const startPos = view.state.selection.from;
    insertText(view, beforeCursor + afterCursor);
    // Place cursor where {{cursor}} was
    setTextSelection(view, startPos + beforeCursor.length);
    return true;
  }
  insertText(view, content);
  return true;
}

/**
 * Processes and inserts template content through the markdown compiler,
 * trying multiple insertion strategies as fallbacks.
 */
function applyTemplate(view, processedContent) {
  if (!view || !processedContent) return;

  const compiler = getMarkdownCompiler();
  const processedWithMarkdown = compiler.processTemplate(processedContent);

  const methods = [
    () => insertTemplateContent(view, processedWithMarkdown),
    () => insertText(view, processedWithMarkdown),
    () => {
      const { state } = view;
      const pos = state.selection.from;
      const cleanContent = processedWithMarkdown.replace(/\{\{cursor\}\}/g, '');
      view.dispatch(state.tr.insertText(cleanContent, pos));
    },
  ];

  for (const method of methods) {
    try {
      method();
      return;
    } catch {
      // try next method
    }
  }
}

/**
 * ModalLayer — renders all modals and overlays for the workspace.
 *
 * Panel visibility flags are read from useViewStore.
 * Tab/file state is read from useEditorGroupStore.
 */
export default function ModalLayer({
  workspacePath,
  onFileOpen,
  onCreateFile,
  onCreateTemplateSaved,
  onOpenDailyNoteByDate,
  onConfirmReferenceUpdate,
  onCloseReferenceModal,
}) {
  // Modal visibility flags from useViewStore
  const showCommandPalette = useViewStore((s) => s.showCommandPalette);
  const showInFileSearch = useViewStore((s) => s.showInFileSearch);
  const showShortcutHelp = useViewStore((s) => s.showShortcutHelp);
  const showTemplatePicker = useViewStore((s) => s.showTemplatePicker);
  const templatePickerData = useViewStore((s) => s.templatePickerData);
  const showCreateTemplate = useViewStore((s) => s.showCreateTemplate);
  const createTemplateContent = useViewStore((s) => s.createTemplateContent);
  const showGlobalSearch = useViewStore((s) => s.showGlobalSearch);
  const showTagModal = useViewStore((s) => s.showTagModal);
  const tagModalFile = useViewStore((s) => s.tagModalFile);
  const showAboutDialog = useViewStore((s) => s.showAboutDialog);
  const showDatePickerModal = useViewStore((s) => s.showDatePickerModal);
  const canvasPreview = useViewStore((s) => s.canvasPreview);
  const graphPreview = useViewStore((s) => s.graphPreview);
  const referenceUpdateModal = useViewStore((s) => s.referenceUpdateModal);

  // Focused group id for editor registry lookup
  const focusedGroupId = useEditorGroupStore((s) => s.focusedGroupId);
  const featureFlags = useFeatureFlags();

  // Tab/file state from useEditorGroupStore
  const focusedGroup = useEditorGroupStore((s) => {
    const { layout, focusedGroupId: gid } = s;
    if (!gid) return null;
    const findGroup = (node) => {
      if (node.type === 'group' && node.id === gid) return node;
      if (node.type === 'container') {
        for (const child of node.children) {
          const found = findGroup(child);
          if (found) return found;
        }
      }
      return null;
    };
    return findGroup(layout);
  });

  const openTabs = focusedGroup?.tabs ?? [];
  const activeFile = focusedGroup?.activeTab ?? null;

  // filteredFileTree sourced directly from the file tree store
  const fileTree = useFileTreeStore((s) => s.fileTree);

  // Stable handlers sourced from stores (replaces missing props)
  const handleSave = () => {
    // useSave's handleSave resolves editor from registry when called with no args
    // Dispatch a DOM event that ShortcutListener / useSave already handles,
    // or call the store-resolved save directly via the registry
    const store = useEditorGroupStore.getState();
    const group = store.getFocusedGroup?.();
    if (!group) return;
    const editor = getEditor(group.id);
    if (!editor || !group.activeTab) return;
    window.dispatchEvent(new CustomEvent('lokus:save', { detail: { editor, filePath: group.activeTab, groupId: group.id } }));
  };

  const handleTabClose = (path) => {
    const store = useEditorGroupStore.getState();
    const groupId = store.focusedGroupId || store.getAllGroups()[0]?.id;
    if (groupId) store.removeTab(groupId, path);
  };

  const handleCreateFolder = () => {
    useFileTreeStore.getState().startCreate('folder', null);
  };

  const handleOpenDailyNote = () => {
    if (!featureFlags.enable_daily_notes) return;
    window.dispatchEvent(new CustomEvent('lokus:open-daily-note'));
  };

  const handleCreateTemplate = () => {
    useViewStore.getState().openPanel('showCreateTemplate');
  };

  const handleOpenPreferences = () => {
    (async () => {
      try {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('preferences:open');
      } catch {
        try {
          window.dispatchEvent(new CustomEvent('preferences:open'));
        } catch {
          // ignore
        }
      }
    })();
  };

  const handleOpenGraph = () => {
    if (!featureFlags.enable_graph) return;
    const graphPath = '__professional_graph__';
    const graphName = 'Professional Graph';
    const { focusedGroupId } = useEditorGroupStore.getState();
    if (focusedGroupId) {
      useEditorGroupStore.getState().addTab(
        focusedGroupId,
        { path: graphPath, name: graphName },
        true
      );
    }
  };

  const handleShowTemplatePicker = (templateSelection) => {
    // Handle direct template selection from Command Palette
    if (
      templateSelection &&
      templateSelection.template &&
      templateSelection.processedContent
    ) {
      const editor = getEditor(focusedGroupId);
      if (editor) {
        try {
          applyTemplate(editor, templateSelection.processedContent);
        } catch {
          // ignore
        }
      }
      return;
    }

    // Fall back to opening the template picker modal
    const editor = getEditor(focusedGroupId);
    useViewStore.getState().openPanel('showTemplatePicker');
    useViewStore.setState({
      templatePickerData: {
        editorState: { editor },
        onSelect: (template, processedContent) => {
          const currentEditor = getEditor(useEditorGroupStore.getState().focusedGroupId);
          if (currentEditor && processedContent) {
            try {
              applyTemplate(currentEditor, processedContent);
            } catch {
              // ignore
            }
          }
        },
      },
    });
  };

  return (
    <>
      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        setOpen={(v) => useViewStore.setState({ showCommandPalette: v })}
        fileTree={fileTree}
        openFiles={openTabs}
        onFileOpen={onFileOpen}
        onCreateFile={onCreateFile}
        onCreateFolder={handleCreateFolder}
        onSave={handleSave}
        onOpenPreferences={handleOpenPreferences}
        onToggleSidebar={() => useLayoutStore.getState().toggleLeft()}
        onCloseTab={handleTabClose}
        onOpenGraph={handleOpenGraph}
        onShowTemplatePicker={handleShowTemplatePicker}
        onCreateTemplate={handleCreateTemplate}
        onOpenDailyNote={handleOpenDailyNote}
        onRefresh={() => useFileTreeStore.getState().refreshTree()}
        activeFile={activeFile}
      />

      {/* In-file search */}
      <InFileSearch
        editor={getEditor(focusedGroupId)}
        isVisible={showInFileSearch}
        onClose={() => useViewStore.getState().closePanel('showInFileSearch')}
      />

      {/* Template picker */}
      {featureFlags.enable_templates && showTemplatePicker && templatePickerData && (
        <TemplatePicker
          open={showTemplatePicker}
          onClose={() => {
            useViewStore.getState().closePanel('showTemplatePicker');
            useViewStore.setState({ templatePickerData: null });
          }}
          onSelect={(template, processedContent) => {
            if (templatePickerData.onSelect) {
              templatePickerData.onSelect(template, processedContent);
            }
            useViewStore.getState().closePanel('showTemplatePicker');
            useViewStore.setState({ templatePickerData: null });
          }}
          editorState={templatePickerData.editorState}
        />
      )}

      {/* Full-text search */}
      <FullTextSearchPanel
        isOpen={showGlobalSearch}
        onClose={() => useViewStore.getState().closePanel('showGlobalSearch')}
        onResultClick={(result) => {
          if (result.path) {
            onFileOpen({
              path: result.path,
              name: getFilename(result.path),
              lineNumber: result.lineNumber,
              column: result.column,
            });
          }
          useViewStore.getState().closePanel('showGlobalSearch');
        }}
        workspacePath={workspacePath}
      />

      {/* Shortcut help */}
      <ShortcutHelpModal
        isOpen={showShortcutHelp}
        onClose={() => useViewStore.getState().closePanel('showShortcutHelp')}
      />

      {/* Create template */}
      <CreateTemplate
        open={featureFlags.enable_templates && showCreateTemplate}
        onClose={() => useViewStore.getState().closePanel('showCreateTemplate')}
        initialContent={createTemplateContent}
        onSaved={onCreateTemplateSaved}
      />

      {/* Date picker for daily notes */}
      <DatePickerModal
        isOpen={featureFlags.enable_daily_notes && showDatePickerModal}
        onClose={() => useViewStore.getState().closePanel('showDatePickerModal')}
        onDateSelect={onOpenDailyNoteByDate}
        workspacePath={workspacePath}
      />

      {/* Tag management */}
      <TagManagementModal
        isOpen={showTagModal}
        onClose={() => {
          useViewStore.getState().closePanel('showTagModal');
          useViewStore.setState({ tagModalFile: null });
        }}
        file={tagModalFile}
        onTagsUpdated={() => useFileTreeStore.getState().refreshTree()}
      />

      {/* About dialog */}
      <AboutDialog
        isOpen={showAboutDialog}
        onClose={() => useViewStore.getState().closePanel('showAboutDialog')}
      />

      {/* Reference update modal */}
      <ReferenceUpdateModal
        isOpen={referenceUpdateModal?.isOpen}
        oldPath={referenceUpdateModal?.oldPath}
        newPath={referenceUpdateModal?.newPath}
        affectedFiles={referenceUpdateModal?.affectedFiles}
        isProcessing={referenceUpdateModal?.isProcessing}
        result={referenceUpdateModal?.result}
        onConfirm={onConfirmReferenceUpdate}
        onClose={onCloseReferenceModal}
      />

      {/* Canvas preview popup */}
      {canvasPreview && (
        <CanvasPreviewPopup
          canvasName={canvasPreview.canvasName}
          canvasPath={canvasPreview.canvasPath}
          position={canvasPreview.position}
          thumbnailUrl={canvasPreview.thumbnailUrl}
          loading={canvasPreview.loading}
          error={canvasPreview.error}
          onClose={() => useViewStore.setState({ canvasPreview: null })}
        />
      )}

      {/* Graph preview popup */}
      {graphPreview && (
        <GraphPreviewPopup
          graphName={graphPreview.graphName}
          graphPath={graphPreview.graphPath}
          position={graphPreview.position}
          thumbnailUrl={graphPreview.thumbnailUrl}
          loading={graphPreview.loading}
          error={graphPreview.error}
          onClose={() => useViewStore.setState({ graphPreview: null })}
        />
      )}
    </>
  );
}
