
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
    'graph': 'graph/graph',

    // File Tree
    'FileTree': 'file-tree/FileTree',
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
    'SplitEditor': 'editor/SplitEditor',
    'WikiLinkModal.jsx': 'editor/WikiLinkModal.jsx',

    // UI
    'AboutDialog.jsx': 'ui/AboutDialog.jsx',
    'DropZoneOverlay.jsx': 'ui/DropZoneOverlay.jsx',
    'ExternalDropZone.jsx': 'ui/ExternalDropZone.jsx',
    'FileIcon.jsx': 'ui/FileIcon.jsx',
    'GlobalContextMenu.jsx': 'ui/GlobalContextMenu.jsx',
    'ImageViewer': 'ui/ImageViewer',
    'LokusLogo.jsx': 'ui/LokusLogo.jsx',
    'OptimizedWrapper.jsx': 'ui/OptimizedWrapper.jsx',
    'PagePreview.jsx': 'ui/PagePreview.jsx',
    'ShortcutHelpModal.jsx': 'ui/ShortcutHelpModal.jsx',
    'ThemeToggle.jsx': 'ui/ThemeToggle.jsx',
    'Toast.jsx': 'ui/Toast.jsx',
    'error': 'ui/error',
    'icons': 'ui/icons',

    // Features
    'AIAssistantSetup.jsx': 'features/AIAssistantSetup.jsx',
    'Auth': 'features/Auth',
    'CommandPalette.jsx': 'features/CommandPalette.jsx',
    'CreateTemplate.jsx': 'features/CreateTemplate.jsx',
    'DailyNotes': 'features/DailyNotes',
    'ImportWizard.jsx': 'features/ImportWizard.jsx',
    'KanbanBoard.jsx': 'features/KanbanBoard.jsx',
    'KanbanList.jsx': 'features/KanbanList.jsx',
    'MCPServer': 'features/MCPServer',
    'PDFViewer': 'features/PDFViewer',
    'PluginManager.jsx': 'features/PluginManager.jsx',
    'PluginPanel.jsx': 'features/PluginPanel.jsx',
    'ProductTour.jsx': 'features/ProductTour.jsx',
    'SearchPanel.jsx': 'features/SearchPanel.jsx',
    'Settings': 'features/Settings',
    'TagManagementModal.jsx': 'features/TagManagementModal.jsx',
    'TaskCreationModal.jsx': 'features/TaskCreationModal.jsx',
    'TemplateCommandPalette.jsx': 'features/TemplateCommandPalette.jsx',
    'TemplatePicker.jsx': 'features/TemplatePicker.jsx',
    'TemplatePreview.jsx': 'features/TemplatePreview.jsx',
    'Templates': 'features/Templates',
    'UpdateChecker.jsx': 'features/UpdateChecker.jsx',
    'VersionHistoryPanel.jsx': 'features/VersionHistoryPanel.jsx',
    'canvas': 'features/canvas',
    'gmail': 'features/gmail',
};

const COMPONENTS_DIR = path.resolve('./src/components');

function walkSync(dir, filelist = []) {
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        if (fs.statSync(dirFile).isDirectory()) {
            filelist = walkSync(dirFile, filelist);
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
                filelist.push(dirFile);
            }
        }
    });
    return filelist;
}

const files = walkSync(COMPONENTS_DIR);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Get the relative path of this file from src/components
    // e.g. 'ui/AboutDialog.jsx'
    const relPath = path.relative(COMPONENTS_DIR, file);
    const currentDir = path.dirname(relPath); // 'ui'

    // Regex to find imports
    // Matches: import ... from "..."
    const importRegex = /from\s+['"]([^'"]+)['"]/g;

    content = content.replace(importRegex, (match, importPath) => {
        let newImportPath = importPath;

        // Case 1: Import starts with ../ (going out of components)
        // Since we moved 1 level deeper, we need to add another ../
        if (importPath.startsWith('../')) {
            // But wait, if it was ../../ something, it becomes ../../../
            // We just prepend ../
            newImportPath = '../' + importPath;
        }
        // Case 2: Import starts with ./ (sibling)
        else if (importPath.startsWith('./')) {
            // It was a sibling in src/components.
            // e.g. './Button.jsx'
            const targetName = importPath.replace('./', '');

            // Check if this target moved
            // We need to handle extensions.
            let targetKey = targetName;
            if (!targetKey.endsWith('.jsx') && !targetKey.endsWith('.js')) {
                // Try to find it in MOVED_COMPONENTS keys
                const found = Object.keys(MOVED_COMPONENTS).find(k => k.replace(/\.(jsx|js)$/, '') === targetName);
                if (found) targetKey = found;
            }

            if (MOVED_COMPONENTS[targetKey]) {
                const targetNewPath = MOVED_COMPONENTS[targetKey]; // 'ui/Button.jsx'

                // Calculate relative path from currentDir to targetNewPath
                // from 'ui' to 'ui/Button.jsx' -> './Button.jsx'
                // from 'ui' to 'layout/StatusBar.jsx' -> '../layout/StatusBar.jsx'

                // We need to construct the full paths to use path.relative
                const fromDir = path.join('/tmp', currentDir);
                const toFile = path.join('/tmp', targetNewPath);

                let relative = path.relative(fromDir, toFile);
                if (!relative.startsWith('.')) {
                    relative = './' + relative;
                }
                newImportPath = relative;
            } else {
                // Target didn't move? Or it's a file we missed?
                // If it didn't move, it's still in src/components root.
                // So from 'ui', we need '../Target.jsx'
                newImportPath = '../' + targetName;
            }
        }

        if (newImportPath !== importPath) {
            changed = true;
            return `from "${newImportPath}"`;
        }
        return match;
    });

    if (changed) {
        console.log(`Fixing internal imports in ${relPath}`);
        fs.writeFileSync(file, content);
    }
});
