import { useWorkspaceStore } from '../../stores/workspace';
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

const MAX_OPEN_TABS = 10;

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
 * Panel visibility flags are read from useWorkspaceStore (migration source)
 * and will gradually move to useViewStore.
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
  // Modals from workspace store (legacy, migrating to viewStore)
  const showCommandPalette = useWorkspaceStore((s) => s.showCommandPalette);
  const showInFileSearch = useWorkspaceStore((s) => s.showInFileSearch);
  const showShortcutHelp = useWorkspaceStore((s) => s.showShortcutHelp);
  const showTemplatePicker = useWorkspaceStore((s) => s.showTemplatePicker);
  const templatePickerData = useWorkspaceStore((s) => s.templatePickerData);
  const showCreateTemplate = useWorkspaceStore((s) => s.showCreateTemplate);
  const createTemplateContent = useWorkspaceStore((s) => s.createTemplateContent);
  const showGlobalSearch = useWorkspaceStore((s) => s.showGlobalSearch);
  const showTagModal = useWorkspaceStore((s) => s.showTagModal);
  const tagModalFile = useWorkspaceStore((s) => s.tagModalFile);
  const showAboutDialog = useWorkspaceStore((s) => s.showAboutDialog);
  const showDatePickerModal = useWorkspaceStore((s) => s.showDatePickerModal);
  const canvasPreview = useWorkspaceStore((s) => s.canvasPreview);
  const referenceUpdateModal = useWorkspaceStore((s) => s.referenceUpdateModal);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const activeFile = useWorkspaceStore((s) => s.activeFile);

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
    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter((t) => t.path !== graphPath);
      newTabs.unshift({ path: graphPath, name: graphName });
      if (newTabs.length > MAX_OPEN_TABS) newTabs.pop();
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: graphPath });
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
    useWorkspaceStore.getState().openPanel('showTemplatePicker');
    useWorkspaceStore.setState({
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
        setOpen={(v) => useWorkspaceStore.setState({ showCommandPalette: v })}
        fileTree={filteredFileTree}
        openFiles={openTabs}
        onFileOpen={onFileOpen}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onSave={onSave}
        onOpenPreferences={handleOpenPreferences}
        onToggleSidebar={() => useWorkspaceStore.getState().toggleLeft()}
        onCloseTab={onTabClose}
        onOpenGraph={handleOpenGraph}
        onShowTemplatePicker={handleShowTemplatePicker}
        onCreateTemplate={onCreateTemplate}
        onOpenDailyNote={onOpenDailyNote}
        onRefresh={() => useWorkspaceStore.getState().refreshTree()}
        activeFile={activeFile}
      />

      {/* In-file search */}
      <InFileSearch
        editor={editorRef?.current}
        isVisible={showInFileSearch}
        onClose={() => useWorkspaceStore.getState().closePanel('showInFileSearch')}
      />

      {/* Template picker */}
      {showTemplatePicker && templatePickerData && (
        <TemplatePicker
          open={showTemplatePicker}
          onClose={() => {
            useWorkspaceStore.getState().closePanel('showTemplatePicker');
            useWorkspaceStore.setState({ templatePickerData: null });
          }}
          onSelect={(template, processedContent) => {
            if (templatePickerData.onSelect) {
              templatePickerData.onSelect(template, processedContent);
            }
            useWorkspaceStore.getState().closePanel('showTemplatePicker');
            useWorkspaceStore.setState({ templatePickerData: null });
          }}
          editorState={templatePickerData.editorState}
        />
      )}

      {/* Full-text search */}
      <FullTextSearchPanel
        isOpen={showGlobalSearch}
        onClose={() => useWorkspaceStore.getState().closePanel('showGlobalSearch')}
        onResultClick={(result) => {
          if (result.path) {
            onFileOpen({
              path: result.path,
              name: getFilename(result.path),
              lineNumber: result.lineNumber,
              column: result.column,
            });
          }
          useWorkspaceStore.getState().closePanel('showGlobalSearch');
        }}
        workspacePath={workspacePath}
      />

      {/* Shortcut help */}
      <ShortcutHelpModal
        isOpen={showShortcutHelp}
        onClose={() => useWorkspaceStore.getState().closePanel('showShortcutHelp')}
      />

      {/* Create template */}
      <CreateTemplate
        open={showCreateTemplate}
        onClose={() => useWorkspaceStore.getState().closePanel('showCreateTemplate')}
        initialContent={createTemplateContent}
        onSaved={onCreateTemplateSaved}
      />

      {/* Date picker for daily notes */}
      <DatePickerModal
        isOpen={showDatePickerModal}
        onClose={() => useWorkspaceStore.getState().closePanel('showDatePickerModal')}
        onDateSelect={onOpenDailyNoteByDate}
        workspacePath={workspacePath}
      />

      {/* Tag management */}
      <TagManagementModal
        isOpen={showTagModal}
        onClose={() => {
          useWorkspaceStore.getState().closePanel('showTagModal');
          useWorkspaceStore.setState({ tagModalFile: null });
        }}
        file={tagModalFile}
        onTagsUpdated={() => useWorkspaceStore.getState().refreshTree()}
      />

      {/* About dialog */}
      <AboutDialog
        isOpen={showAboutDialog}
        onClose={() => useWorkspaceStore.getState().closePanel('showAboutDialog')}
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
          onClose={() => useWorkspaceStore.setState({ canvasPreview: null })}
        />
      )}
    </>
  );
}
