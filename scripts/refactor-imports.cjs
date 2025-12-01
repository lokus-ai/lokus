
const fs = require('fs');
const path = require('path');

const MOVED_COMPONENTS = {
  // Layout
  'StatusBar.jsx': 'layout/StatusBar.jsx',
  'TabBar.jsx': 'layout/TabBar.jsx',
  'ConnectionStatus.jsx': 'layout/ConnectionStatus.jsx',
  'FolderScopeStatusWidget.jsx': 'layout/FolderScopeStatusWidget.jsx',

  // Graph
  'FocusedGraphView.jsx': 'graph/FocusedGraphView.jsx',
  'GraphSidebar.jsx': 'graph/GraphSidebar.jsx',
  'graph': 'graph/graph', // Directory move

  // File Tree
  'FileTree': 'file-tree/FileTree', // Directory move
  'FileContextMenu.jsx': 'file-tree/FileContextMenu.jsx',
  'FolderSelector.jsx': 'file-tree/FolderSelector.jsx',

  // Editor
  'DiffView.jsx': 'editor/DiffView.jsx',
  'DocumentOutline.jsx': 'editor/DocumentOutline.jsx',
  'EditorContextMenu.jsx': 'editor/EditorContextMenu.jsx',
  'EditorGroup.jsx': 'editor/EditorGroup.jsx',
  'EditorGroupsContainer.jsx': 'editor/EditorGroupsContainer.jsx',
  'ImageInsertModal.jsx': 'editor/ImageInsertModal.jsx',
  'InFileSearch.jsx': 'editor/InFileSearch.jsx',
  'MathFormulaModal.jsx': 'editor/MathFormulaModal.jsx',
  'MermaidViewerModal.jsx': 'editor/MermaidViewerModal.jsx',
  'SplitEditor': 'editor/SplitEditor', // Directory move
  'WikiLinkModal.jsx': 'editor/WikiLinkModal.jsx',

  // UI
  'AboutDialog.jsx': 'ui/AboutDialog.jsx',
  'DropZoneOverlay.jsx': 'ui/DropZoneOverlay.jsx',
  'ExternalDropZone.jsx': 'ui/ExternalDropZone.jsx',
  'FileIcon.jsx': 'ui/FileIcon.jsx',
  'GlobalContextMenu.jsx': 'ui/GlobalContextMenu.jsx',
  'ImageViewer': 'ui/ImageViewer', // Directory move
  'LokusLogo.jsx': 'ui/LokusLogo.jsx',
  'OptimizedWrapper.jsx': 'ui/OptimizedWrapper.jsx',
  'PagePreview.jsx': 'ui/PagePreview.jsx',
  'ShortcutHelpModal.jsx': 'ui/ShortcutHelpModal.jsx',
  'ThemeToggle.jsx': 'ui/ThemeToggle.jsx',
  'Toast.jsx': 'ui/Toast.jsx',
  'error': 'ui/error', // Directory move
  'icons': 'ui/icons', // Directory move

  // Features
  'AIAssistantSetup.jsx': 'features/AIAssistantSetup.jsx',
  'Auth': 'features/Auth', // Directory move
  'CommandPalette.jsx': 'features/CommandPalette.jsx',
  'CreateTemplate.jsx': 'features/CreateTemplate.jsx',
  'DailyNotes': 'features/DailyNotes', // Directory move
  'ImportWizard.jsx': 'features/ImportWizard.jsx',
  'KanbanBoard.jsx': 'features/KanbanBoard.jsx',
  'KanbanList.jsx': 'features/KanbanList.jsx',
  'MCPServer': 'features/MCPServer', // Directory move
  'PDFViewer': 'features/PDFViewer', // Directory move
  'PluginManager.jsx': 'features/PluginManager.jsx',
  'PluginPanel.jsx': 'features/PluginPanel.jsx',
  'ProductTour.jsx': 'features/ProductTour.jsx',
  'SearchPanel.jsx': 'features/SearchPanel.jsx',
  'Settings': 'features/Settings', // Directory move
  'TagManagementModal.jsx': 'features/TagManagementModal.jsx',
  'TaskCreationModal.jsx': 'features/TaskCreationModal.jsx',
  'TemplateCommandPalette.jsx': 'features/TemplateCommandPalette.jsx',
  'TemplatePicker.jsx': 'features/TemplatePicker.jsx',
  'TemplatePreview.jsx': 'features/TemplatePreview.jsx',
  'Templates': 'features/Templates', // Directory move
  'UpdateChecker.jsx': 'features/UpdateChecker.jsx',
  'VersionHistoryPanel.jsx': 'features/VersionHistoryPanel.jsx',
  'canvas': 'features/canvas', // Directory move
  'gmail': 'features/gmail', // Directory move
};

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const files = walkSync('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Update imports TO moved files
  for (const [oldName, newPath] of Object.entries(MOVED_COMPONENTS)) {
    // Regex to match imports: import ... from '.../components/OldName'
    // or '.../components/OldName/...'
    
    // Simple check for now: look for /components/OldName
    const regex = new RegExp(`(/components/)${oldName.replace(/\./g, '\\.')}(['"/])`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${newPath}$2`);
      changed = true;
    }
    
    // Also check for imports without extension if it's a .jsx file
    if (oldName.endsWith('.jsx')) {
        const noExt = oldName.replace('.jsx', '');
        const newPathNoExt = newPath.replace('.jsx', '');
        const regexNoExt = new RegExp(`(/components/)${noExt}(['"/])`, 'g');
        if (regexNoExt.test(content)) {
            content = content.replace(regexNoExt, `$1${newPathNoExt}$2`);
            changed = true;
        }
    }
  }

  // 2. Fix relative imports inside moved files
  // If the current file is one of the moved files (now in a subdir), we need to adjust its imports
  // But wait, the file path `file` variable is the CURRENT path on disk.
  // I already moved the files. So `file` will be `src/components/ui/AboutDialog.jsx`.
  
  const isInComponents = file.includes('src/components/');
  if (isInComponents) {
      // Check if it's in a subdir
      const relPath = path.relative('./src/components', file);
      if (relPath.includes('/')) { // It is in a subdir like ui/AboutDialog.jsx
          // We need to fix imports that go up.
          // e.g. import ... from '../utils' -> '../../utils'
          // e.g. import ... from './OtherComponent' -> '../OtherComponent' (if OtherComponent wasn't moved to same dir)
          
          // This is hard to automate perfectly without AST.
          // Let's rely on the build to fail and fix manually?
          // Or try a heuristic:
          // If import starts with '../', make it '../../'
          // If import starts with './', make it '../' UNLESS it refers to a file in the same new subdir.
          
          // Actually, let's skip step 2 for the script and do it manually/iteratively.
          // Step 1 covers 90% of the work (Workspace.jsx, App.jsx, etc).
      }
  }

  if (changed) {
    console.log(`Updating ${file}`);
    fs.writeFileSync(file, content);
  }
});
