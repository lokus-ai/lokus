import { useViewStore } from '../../stores/views';
import { useEditorGroupStore } from '../../stores/editorGroups';
import { useLayoutStore } from '../../stores/layout';
import { useFileTreeStore } from '../../stores/fileTree';
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
import { DatePickerModal } from '../../components/DailyNotes/index.js';
import { getMarkdownCompiler } from '../../core/markdown/compiler.js';
import { getFilename } from '../../utils/pathUtils.js';

/**
 * Inserts template content into the editor, handling the {{cursor}} placeholder.
 */
function insertTemplateContent(editorInstance, content) {
  const cursorIndex = content.indexOf('{{cursor}}');
  if (cursorIndex !== -1) {
    const beforeCursor = content.substring(0, cursorIndex);
    const afterCursor = content.substring(cursorIndex + 10);
    return editorInstance
      .chain()
      .focus()
      .insertContent(beforeCursor)
      .insertContent(afterCursor)
      .setTextSelection(beforeCursor.length + editorInstance.state.selection.from)
      .run();
  }
  return editorInstance.chain().focus().insertContent(content).run();
}

/**
 * Processes and inserts template content through the markdown compiler,
 * trying multiple insertion strategies as fallbacks.
 */
function applyTemplate(editorInstance, processedContent) {
  if (!editorInstance || !processedContent) return;

  const compiler = getMarkdownCompiler();
  const processedWithMarkdown = compiler.processTemplate(processedContent);

  const methods = [
    () => insertTemplateContent(editorInstance, processedWithMarkdown),
    () => editorInstance.chain().focus().insertContent(processedWithMarkdown).run(),
    () => {
      editorInstance.commands.focus();
      return editorInstance.commands.insertContent(processedWithMarkdown);
    },
    () => editorInstance.commands.insertContent(processedWithMarkdown),
    () => {
      const { view } = editorInstance;
      const { state } = view;
      const { tr } = state;
      const pos = state.selection.from;
      const cleanContent = processedWithMarkdown.replace(/\{\{cursor\}\}/g, '');
      view.dispatch(tr.insertText(cleanContent, pos));
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
  filteredFileTree,
  onFileOpen,
  onCreateFile,
  onCreateFolder,
  onOpenDailyNote,
  onCreateTemplate,
  onCreateTemplateSaved,
  onOpenDailyNoteByDate,
  onSave,
  onTabClose,
  onConfirmReferenceUpdate,
  onCloseReferenceModal,
  editorRef,
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
  const referenceUpdateModal = useViewStore((s) => s.referenceUpdateModal);

  // Tab/file state from useEditorGroupStore
  const focusedGroup = useEditorGroupStore((s) => {
    const { layout, focusedGroupId } = s;
    if (!focusedGroupId) return null;
    const findGroup = (node) => {
      if (node.type === 'group' && node.id === focusedGroupId) return node;
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
      if (editorRef?.current) {
        try {
          applyTemplate(editorRef.current, templateSelection.processedContent);
        } catch {
          // ignore
        }
      }
      return;
    }

    // Fall back to opening the template picker modal
    useViewStore.getState().openPanel('showTemplatePicker');
    useViewStore.setState({
      templatePickerData: {
        editorState: { editor: editorRef?.current },
        onSelect: (template, processedContent) => {
          if (editorRef?.current && processedContent) {
            try {
              applyTemplate(editorRef.current, processedContent);
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
        fileTree={filteredFileTree}
        openFiles={openTabs}
        onFileOpen={onFileOpen}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onSave={onSave}
        onOpenPreferences={handleOpenPreferences}
        onToggleSidebar={() => useLayoutStore.getState().toggleLeft()}
        onCloseTab={onTabClose}
        onOpenGraph={handleOpenGraph}
        onShowTemplatePicker={handleShowTemplatePicker}
        onCreateTemplate={onCreateTemplate}
        onOpenDailyNote={onOpenDailyNote}
        onRefresh={() => useFileTreeStore.getState().refreshTree()}
        activeFile={activeFile}
      />

      {/* In-file search */}
      <InFileSearch
        editor={editorRef?.current}
        isVisible={showInFileSearch}
        onClose={() => useViewStore.getState().closePanel('showInFileSearch')}
      />

      {/* Template picker */}
      {showTemplatePicker && templatePickerData && (
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
        open={showCreateTemplate}
        onClose={() => useViewStore.getState().closePanel('showCreateTemplate')}
        initialContent={createTemplateContent}
        onSaved={onCreateTemplateSaved}
      />

      {/* Date picker for daily notes */}
      <DatePickerModal
        isOpen={showDatePickerModal}
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
    </>
  );
}
