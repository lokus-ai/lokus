/**
 * Workspace API - Workspace management and file events
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class WorkspaceAPI extends EventEmitter {
    constructor(workspaceManager) {
        super();
        this.workspaceManager = workspaceManager;
        this.rootPath = null;
        this.workspaceFolders = [];
    }

    /**
     * Get workspace folders
     */
    get workspaceFolders() {
        if (this.workspaceManager) {
            return this.workspaceManager.getWorkspaceFolders();
        }
        return this._workspaceFolders || [];
    }

    set workspaceFolders(folders) {
        this._workspaceFolders = folders;
    }

    /**
     * Get root path (deprecated but often used)
     */
    get rootPath() {
        if (this.workspaceManager) {
            return this.workspaceManager.getRootPath();
        }
        return this._rootPath;
    }

    set rootPath(path) {
        this._rootPath = path;
    }

    /**
     * Get configuration
     */
    getConfiguration(section) {
        // Delegate to ConfigurationAPI if available, or return mock
        // This is often accessed via workspace.getConfiguration in VS Code API
        // But in our SDK it might be separate. We'll implement it here for compat.
        if (this.currentPlugin && this.currentPlugin.api && this.currentPlugin.api.config) {
            return this.currentPlugin.api.config.getConfiguration(section);
        }
        return {
            get: (key, defaultValue) => defaultValue,
            has: () => false,
            update: async () => { }
        };
    }

    /**
     * Open a text document
     */
    async openTextDocument(uriOrFileName) {
        // TODO: Connect to actual document opener
        return null;
    }

    /**
     * Get workspace folder for URI
     */
    getWorkspaceFolder(uri) {
        const uriStr = typeof uri === 'string' ? uri : uri.toString();
        return this.workspaceFolders.find(folder => uriStr.startsWith(folder.uri.path));
    }

    /**
     * Get relative path
     */
    asRelativePath(pathOrUri, includeWorkspaceFolder) {
        const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.path;

        for (const folder of this.workspaceFolders) {
            if (path.startsWith(folder.uri.path)) {
                let relative = path.substring(folder.uri.path.length);
                if (relative.startsWith('/')) relative = relative.substring(1);

                if (includeWorkspaceFolder) {
                    return `${folder.name}/${relative}`;
                }
                return relative;
            }
        }
        return path;
    }

    /**
     * Apply workspace edit
     */
    async applyEdit(edit) {
        return false;
    }

    /**
     * Register text document content provider
     */
    registerTextDocumentContentProvider(scheme, provider) {
        // TODO: Implement content provider registration
        return { dispose: () => { } };
    }

    /**
     * Create file system watcher
     */
    createFileSystemWatcher(globPattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents) {
        const watcher = new EventEmitter();

        // TODO: Connect to actual file system watcher

        watcher.dispose = () => {
            // Cleanup
        };

        return watcher;
    }

    /**
     * Find files
     */
    async findFiles(include, exclude, maxResults, token) {
        // TODO: Implement file search
        return [];
    }

    /**
     * Save all dirty files
     */
    async saveAll(includeUntitled) {
        // TODO: Implement save all
        return true;
    }
}
