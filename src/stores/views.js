import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const PANEL_MAP = {
  commandPalette:   'showCommandPalette',
  inFileSearch:     'showInFileSearch',
  shortcutHelp:     'showShortcutHelp',
  templatePicker:   ['showTemplatePicker', 'templatePickerData'],
  createTemplate:   'showCreateTemplate',
  globalSearch:     'showGlobalSearch',
  tagModal:         ['showTagModal', 'tagModalFile'],
  aboutDialog:      'showAboutDialog',
  datePickerModal:  'showDatePickerModal',
  versionHistory:   ['showVersionHistory', 'versionHistoryFile'],
  showCommandPalette:   'showCommandPalette',
  showInFileSearch:     'showInFileSearch',
  showShortcutHelp:     'showShortcutHelp',
  showTemplatePicker:   ['showTemplatePicker', 'templatePickerData'],
  showCreateTemplate:   'showCreateTemplate',
  showGlobalSearch:     'showGlobalSearch',
  showTagModal:         ['showTagModal', 'tagModalFile'],
  showAboutDialog:      'showAboutDialog',
  showDatePickerModal:  'showDatePickerModal',
  showVersionHistory:   ['showVersionHistory', 'versionHistoryFile'],
};

export const useViewStore = create(
  subscribeWithSelector((set, get) => ({
    currentView: 'editor',

    showCommandPalette: false,
    showInFileSearch: false,
    showShortcutHelp: false,
    showTemplatePicker: false,
    templatePickerData: null,
    showCreateTemplate: false,
    createTemplateContent: '',
    showGlobalSearch: false,
    showTagModal: false,
    tagModalFile: null,
    showAboutDialog: false,
    selectedFileForCompare: null,
    showDatePickerModal: false,
    currentDailyNoteDate: null,
    showVersionHistory: false,
    versionHistoryFile: null,
    canvasPreview: null,
    versionRefreshKey: 0,
    showDailyNotesPanel: false,
    showCalendarPanel: false,
    referenceUpdateModal: {
      isOpen: false, oldPath: null, newPath: null,
      affectedFiles: [], isProcessing: false, result: null, pendingOperation: null,
    },

    // Valid view values: 'editor' | 'graph' | 'kanban' | 'bases' | 'calendar' |
    //                    'marketplace' | 'canvas' | 'settings' | 'dailyNotes'
    switchView: (view) => set({ currentView: view }),
    incrementVersionRefreshKey: () => set((s) => ({ versionRefreshKey: s.versionRefreshKey + 1 })),

    openPanel: (name, data) => {
      const entry = PANEL_MAP[name];
      if (!entry) return;
      if (Array.isArray(entry)) {
        const [flagKey, dataKey] = entry;
        set({ [flagKey]: true, [dataKey]: data ?? null });
      } else {
        set({ [entry]: true });
      }
    },

    closePanel: (name) => {
      const entry = PANEL_MAP[name];
      if (!entry) return;
      if (Array.isArray(entry)) {
        const [flagKey, dataKey] = entry;
        set({ [flagKey]: false, [dataKey]: null });
      } else {
        set({ [entry]: false });
      }
    },

    togglePanel: (name) => {
      const entry = PANEL_MAP[name];
      if (!entry) return;
      const flagKey = Array.isArray(entry) ? entry[0] : entry;
      set((s) => ({ [flagKey]: !s[flagKey] }));
    },

    setReferenceUpdateModal: (modal) =>
      set((s) => ({
        referenceUpdateModal: { ...s.referenceUpdateModal, ...modal },
      })),
  }))
);
