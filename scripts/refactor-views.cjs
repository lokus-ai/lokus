const fs = require('fs');
const path = require('path');
// const { walkSync } = require('./utils.cjs');

// Define the mapping of moved files
// Key: Original file name (basename)
// Value: New relative path from src/
const MOVED_COMPONENTS = {
    'FullTextSearchPanel.jsx': 'components/features/Search/FullTextSearchPanel.jsx',
    'SearchPanel.jsx': 'components/features/Search/SearchPanel.jsx',
    'SearchResults.jsx': 'components/features/Search/SearchResults.jsx',
    'BacklinksPanel.jsx': 'components/features/Backlinks/BacklinksPanel.jsx',
    'ExportModal.jsx': 'components/features/Export/ExportModal.jsx',
    'TagBrowser.jsx': 'components/features/Tags/TagBrowser.jsx',
    'QuickSwitcher.jsx': 'components/features/QuickSwitcher/QuickSwitcher.jsx',
    'DraggableTab.jsx': 'components/ui/DraggableTab.jsx',
    'PluginDetail.jsx': 'components/features/Plugins/PluginDetail.jsx',
    'PluginSettings.jsx': 'components/features/Plugins/PluginSettings.jsx',
    'PluginManager.jsx': 'components/features/Plugins/PluginManager.jsx',
    'PluginPanel.jsx': 'components/features/Plugins/PluginPanel.jsx',
    'TemplateEditor.jsx': 'components/features/Templates/TemplateEditor.jsx',
    'TemplateManager.jsx': 'components/features/Templates/TemplateManager.jsx',
};

const SRC_DIR = path.resolve(__dirname, '../src');

function updateImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    // 1. Update imports OF the moved components in other files
    for (const [fileName, newPath] of Object.entries(MOVED_COMPONENTS)) {
        // Regex to find imports of this component
        // Examples:
        // import FullTextSearchPanel from './FullTextSearchPanel';
        // import { FullTextSearchPanel } from '../views/FullTextSearchPanel';

        // We need to match the file name in the import path
        const importRegex = new RegExp(`from\\s+['"](.*/)?${fileName.replace('.jsx', '').replace('.js', '')}(['"])`, 'g');

        content = content.replace(importRegex, (match, prefix, quote) => {
            // Calculate relative path from current file to new location
            const currentDir = path.dirname(filePath);
            const absoluteNewPath = path.join(SRC_DIR, newPath);
            let relativePath = path.relative(currentDir, absoluteNewPath);

            if (!relativePath.startsWith('.')) {
                relativePath = './' + relativePath;
            }

            // Remove extension if it wasn't there before (or keep it consistent)
            // Usually imports don't have .jsx extension, but some do.
            // The regex matched the name without extension.
            // But if the original import had extension, we should probably keep it?
            // My regex above assumes NO extension in the import path for the match group.
            // Wait, `fileName.replace('.jsx', '')` removes extension.
            // So if import was `from "./FullTextSearchPanel.jsx"`, regex won't match nicely if I don't handle extension.

            // Let's try a simpler approach: match the whole path and check if it ends with the filename

            return match; // Placeholder, I'll implement better logic below
        });
    }

    // Better approach:
    // Parse imports (simple regex) and check if they point to a moved file.

    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (!line.includes('import') && !line.includes('export') && !line.includes('require')) return line;

        // Extract the path
        const match = line.match(/from\s+['"]([^'"]+)['"]/);
        if (!match) {
            // Handle dynamic imports import(...)
            const dynamicMatch = line.match(/import\(['"]([^'"]+)['"]\)/);
            if (dynamicMatch) {
                return processImportPath(line, dynamicMatch[1], filePath);
            }
            return line;
        }

        return processImportPath(line, match[1], filePath);
    });

    if (newLines.join('\n') !== content) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        console.log(`Updated imports in ${filePath}`);
    }
}

function processImportPath(line, importPath, currentFilePath) {
    // Resolve the import path to an absolute path (or relative to src)
    // This is hard because we don't know the exact resolution logic (webpack/vite), but we can guess.

    if (importPath.startsWith('.')) {
        const currentDir = path.dirname(currentFilePath);
        const absoluteImportPath = path.resolve(currentDir, importPath);

        // Check if this absolute path corresponds to one of our moved files
        for (const [fileName, newRelPath] of Object.entries(MOVED_COMPONENTS)) {
            // We need to check if absoluteImportPath matches the OLD location of the file.
            // But we don't know the OLD location easily here (except by guessing based on filename).
            // Actually, we know the filename.

            const basename = path.basename(absoluteImportPath);
            const nameWithoutExt = basename.replace(/\.(jsx|js|ts|tsx)$/, '');
            const movedNameWithoutExt = fileName.replace(/\.(jsx|js|ts|tsx)$/, '');

            if (nameWithoutExt === movedNameWithoutExt) {
                // Potential match.
                // We should check if the OLD path makes sense.
                // But simpler: if it matches the name, update it to the NEW location.
                // This assumes unique filenames or that we want to move ALL instances.
                // Given our list, filenames are fairly unique (FullTextSearchPanel, etc).

                const absoluteNewPath = path.join(SRC_DIR, newRelPath);
                let newRelativePath = path.relative(currentDir, absoluteNewPath);
                if (!newRelativePath.startsWith('.')) {
                    newRelativePath = './' + newRelativePath;
                }

                // Keep extension if original had it, or add it if we want to be safe?
                // Vite usually handles no extension.
                // But if original had extension, we might want to keep it.
                // Or if new path is .jsx, maybe add it?
                // Let's just use the new path without extension if the old one didn't have it.

                const oldExt = path.extname(importPath);
                if (!oldExt) {
                    // remove extension from newRelativePath if present
                    newRelativePath = newRelativePath.replace(/\.(jsx|js|ts|tsx)$/, '');
                }

                return line.replace(importPath, newRelativePath);
            }
        }
    }

    return line;
}

// 2. Fix internal imports WITHIN the moved files
// (e.g. if FullTextSearchPanel imports something using ../, it might need adjustment)
// This is what my fix-internal-imports.cjs did.
// I should include that logic here too, or run a separate script.
// Since I'm moving files deeper (e.g. views/FullTextSearchPanel -> components/features/Search/FullTextSearchPanel),
// relative imports like '../core' will break (need '../../core').

function fixInternalImports(filePath) {
    // Determine how many levels deeper the file moved.
    // views/ (1 level from src) -> components/features/Search/ (3 levels from src)
    // So diff is +2 levels.
    // So '../' becomes '../../../' ?

    // Actually, let's just recalculate relative paths if we can.
    // But we don't know where the imported file IS easily.

    // Heuristic:
    // If file moved from `src/views` to `src/components/features/Search`:
    // Old depth: 1 (views)
    // New depth: 3 (components/features/Search)
    // Difference: +2.
    // So add `../../` to existing `../` imports?
    // `../core` -> `../../../core`.
    // `./SearchResults` -> `./SearchResults` (if SearchResults also moved to same dir).

    // Let's implement a mapping of "Old Dir" -> "New Dir" for the moved files.
    // FullTextSearchPanel: views -> components/features/Search

    const fileName = path.basename(filePath);
    const newRelPath = MOVED_COMPONENTS[fileName];
    if (!newRelPath) return; // Not a moved file

    const oldRelPath = getOldPath(fileName); // We need to know where it came from.
    if (!oldRelPath) return;

    const oldDir = path.dirname(path.join(SRC_DIR, oldRelPath));
    const newDir = path.dirname(path.join(SRC_DIR, newRelPath));

    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (!line.includes('import') && !line.includes('export') && !line.includes('require')) return line;
        const match = line.match(/from\s+['"]([^'"]+)['"]/);
        if (!match) return line;

        const importPath = match[1];
        if (!importPath.startsWith('.')) return line; // Ignore absolute/package imports

        // Resolve the absolute path of the IMPORTED file using the OLD location
        const absoluteImportedPath = path.resolve(oldDir, importPath);

        // Calculate new relative path from NEW location
        let newRelativePath = path.relative(newDir, absoluteImportedPath);
        if (!newRelativePath.startsWith('.')) {
            newRelativePath = './' + newRelativePath;
        }

        // Preserve extension style
        if (!path.extname(importPath)) {
            newRelativePath = newRelativePath.replace(/\.(jsx|js|ts|tsx)$/, '');
        }

        return line.replace(importPath, newRelativePath);
    });

    if (newLines.join('\n') !== content) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        console.log(`Fixed internal imports in ${filePath}`);
    }
}

function getOldPath(fileName) {
    // Hardcoded mapping of where files came from
    const OLD_PATHS = {
        'FullTextSearchPanel.jsx': 'views/FullTextSearchPanel.jsx',
        'SearchPanel.jsx': 'components/features/SearchPanel.jsx',
        'SearchResults.jsx': 'views/SearchResults.jsx',
        'BacklinksPanel.jsx': 'views/BacklinksPanel.jsx',
        'ExportModal.jsx': 'views/ExportModal.jsx',
        'TagBrowser.jsx': 'views/TagBrowser.jsx',
        'QuickSwitcher.jsx': 'views/QuickSwitcher.jsx',
        'DraggableTab.jsx': 'views/DraggableTab.jsx',
        'PluginDetail.jsx': 'views/PluginDetail.jsx',
        'PluginSettings.jsx': 'views/PluginSettings.jsx',
        'PluginManager.jsx': 'components/features/PluginManager.jsx',
        'PluginPanel.jsx': 'components/features/PluginPanel.jsx',
        'TemplateEditor.jsx': 'views/TemplateEditor.jsx',
        'TemplateManager.jsx': 'views/TemplateManager.jsx',
    };
    return OLD_PATHS[fileName];
}

// Main execution
const allFiles = walkSync(SRC_DIR);

// 1. Update references TO the moved files
allFiles.forEach(file => {
    if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.ts')) {
        updateImports(file);
    }
});

// 2. Fix internal imports FROM the moved files
Object.keys(MOVED_COMPONENTS).forEach(fileName => {
    const newPath = MOVED_COMPONENTS[fileName];
    const fullPath = path.join(SRC_DIR, newPath);
    if (fs.existsSync(fullPath)) {
        fixInternalImports(fullPath);
    }
});

function walkSync(dir, filelist = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else {
            filelist.push(filepath);
        }
    });
    return filelist;
}
