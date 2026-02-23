import React from 'react';
import { useViewStore } from '../../stores/views';
import CommandPalette from '../../components/CommandPalette';
import InFileSearch from '../../components/InFileSearch';
import FullTextSearchPanel from '../FullTextSearchPanel';
import ShortcutHelpModal from '../../components/ShortcutHelpModal';
import TemplatePicker from '../../components/TemplatePicker';
import CreateTemplate from '../../components/CreateTemplate';
import TagManagementModal from '../../components/TagManagementModal';
import AboutDialog from '../../components/AboutDialog';
import ReferenceUpdateModal from '../../components/ReferenceUpdateModal';
import CanvasPreviewPopup from '../../components/CanvasPreviewPopup';
import { DatePickerModal } from '../../components/DailyNotes/index';

/**
 * ModalLayer — renders all modals/overlays based on useViewStore panel flags.
 */
export default function ModalLayer({
  workspacePath,
  onFileOpen,
  onCreateFile,
  onCreateTemplateSaved,
  onOpenDailyNoteByDate,
  editorRef,
}) {
  const showCommandPalette = useViewStore((s) => s.showCommandPalette);
  const showInFileSearch = useViewStore((s) => s.showInFileSearch);
  const showShortcutHelp = useViewStore((s) => s.showShortcutHelp);
  const showTemplatePicker = useViewStore((s) => s.showTemplatePicker);
  const templatePickerData = useViewStore((s) => s.templatePickerData);
  const showCreateTemplate = useViewStore((s) => s.showCreateTemplate);
  const showGlobalSearch = useViewStore((s) => s.showGlobalSearch);
  const showTagModal = useViewStore((s) => s.showTagModal);
  const tagModalFile = useViewStore((s) => s.tagModalFile);
  const showAboutDialog = useViewStore((s) => s.showAboutDialog);
  const showDatePickerModal = useViewStore((s) => s.showDatePickerModal);
  const canvasPreview = useViewStore((s) => s.canvasPreview);
  const referenceUpdateModal = useViewStore((s) => s.referenceUpdateModal);

  return (
    <>
      {showCommandPalette && (
        <CommandPalette
          workspacePath={workspacePath}
          onClose={() => useViewStore.getState().closePanel('commandPalette')}
          onFileOpen={onFileOpen}
          onCreateFile={onCreateFile}
        />
      )}

      {showInFileSearch && editorRef?.current && (
        <InFileSearch
          editor={editorRef.current}
          onClose={() => useViewStore.getState().closePanel('inFileSearch')}
        />
      )}

      {showGlobalSearch && (
        <FullTextSearchPanel
          workspacePath={workspacePath}
          onFileOpen={onFileOpen}
          onClose={() => useViewStore.getState().closePanel('globalSearch')}
        />
      )}

      {showShortcutHelp && (
        <ShortcutHelpModal
          onClose={() => useViewStore.getState().closePanel('shortcutHelp')}
        />
      )}

      {showTemplatePicker && (
        <TemplatePicker
          workspacePath={workspacePath}
          data={templatePickerData}
          onClose={() => useViewStore.getState().closePanel('templatePicker')}
          onFileOpen={onFileOpen}
        />
      )}

      {showCreateTemplate && (
        <CreateTemplate
          workspacePath={workspacePath}
          onClose={() => useViewStore.getState().closePanel('createTemplate')}
          onSave={onCreateTemplateSaved}
        />
      )}

      {showTagModal && tagModalFile && (
        <TagManagementModal
          filePath={tagModalFile}
          workspacePath={workspacePath}
          onClose={() => useViewStore.getState().closePanel('tagModal')}
        />
      )}

      {showDatePickerModal && (
        <DatePickerModal
          onClose={() => useViewStore.getState().closePanel('datePickerModal')}
          onSelectDate={onOpenDailyNoteByDate}
        />
      )}

      {showAboutDialog && (
        <AboutDialog
          onClose={() => useViewStore.getState().closePanel('aboutDialog')}
        />
      )}

      {referenceUpdateModal?.isOpen && (
        <ReferenceUpdateModal />
      )}

      {canvasPreview && (
        <CanvasPreviewPopup
          canvasPath={canvasPreview}
          onClose={() => useViewStore.setState({ canvasPreview: null })}
        />
      )}
    </>
  );
}
