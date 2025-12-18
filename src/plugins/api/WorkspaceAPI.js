/**
 * Workspace API - Workspace management and file events
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';

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
    async openTextDocument(uriOrOptions) {
        const uri = typeof uriOrOptions === 'string'
            ? uriOrOptions
            : uriOrOptions?.content ? 'untitled:new' : null

        if (!uri) {
            throw new Error('Invalid document URI')
        }

        // Emit event for the app to handle
        this.emit('open-document-request', { uri, options: uriOrOptions })

        // Create and return a document adapter
        // The actual content loading happens in the app
        return {
            uri: { toString: () => uri, path: uri },
            fileName: uri.split('/').pop(),
            languageId: this._getLanguageId(uri),
            version: 1,
            isDirty: false,
            isClosed: false,
            getText: () => typeof uriOrOptions === 'object' ? uriOrOptions.content || '' : '',
            lineAt: () => ({ text: '', lineNumber: 0 }),
            lineCount: 1
        }
    }

    /**
     * Get language ID from file extension
     */
    _getLanguageId(uri) {
        const ext = uri.split('.').pop()?.toLowerCase()
        const langMap = {
            'md': 'markdown',
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascriptreact',
            'tsx': 'typescriptreact',
            'json': 'json',
            'css': 'css',
            'html': 'html'
        }
        return langMap[ext] || 'plaintext'
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
        try {
            this.emit('apply-edit-request', { edit })
            return true
        } catch (error) {
            console.error('applyEdit error:', error)
            return false
        }
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
        const watcher = new EventEmitter()

        // Set up file watching (would need Tauri fs watch in real impl)
        watcher.onDidCreate = (listener) => {
            if (!ignoreCreateEvents) {
                watcher.on('create', listener)
            }
            return new Disposable(() => watcher.off('create', listener))
        }

        watcher.onDidChange = (listener) => {
            if (!ignoreChangeEvents) {
                watcher.on('change', listener)
            }
            return new Disposable(() => watcher.off('change', listener))
        }

        watcher.onDidDelete = (listener) => {
            if (!ignoreDeleteEvents) {
                watcher.on('delete', listener)
            }
            return new Disposable(() => watcher.off('delete', listener))
        }

        watcher.dispose = () => {
            watcher.removeAllListeners()
        }

        return watcher
    }

    /**
     * Find files
     */
    async findFiles(include, exclude, maxResults, token) {
        try {
            // Try using Tauri's file system
            const { readDir } = await import('@tauri-apps/plugin-fs')

            // Get workspace root
            const rootPath = this.rootPath || this.workspaceFolders?.[0]?.uri?.path
            if (!rootPath) {
                return []
            }

            const results = []
            const pattern = typeof include === 'string' ? new RegExp(
                include.replace(/\*/g, '.*').replace(/\?/g, '.')
            ) : include

            const excludePattern = exclude ? new RegExp(
                exclude.replace(/\*/g, '.*').replace(/\?/g, '.')
            ) : null

            // Recursive file search
            const searchDir = async (dirPath) => {
                if (token?.isCancellationRequested) return
                if (maxResults && results.length >= maxResults) return

                try {
                    const entries = await readDir(dirPath)

                    for (const entry of entries) {
                        if (token?.isCancellationRequested) return
                        if (maxResults && results.length >= maxResults) return

                        const fullPath = `${dirPath}/${entry.name}`

                        if (excludePattern && excludePattern.test(fullPath)) continue

                        if (entry.isDirectory) {
                            await searchDir(fullPath)
                        } else if (pattern.test(entry.name) || pattern.test(fullPath)) {
                            results.push(fullPath)
                        }
                    }
                } catch (error) {
                    // Skip directories we can't read
                }
            }

            await searchDir(rootPath)
            return results

        } catch (error) {
            console.error('findFiles error:', error)
            return []
        }
    }

    /**
     * Save all dirty files
     */
    async saveAll(includeUntitled = false) {
        this.emit('save-all-request', { includeUntitled })
        return true
    }

    /**
     * Listen to document open events
     */
    onDidOpenTextDocument(listener) {
        const handler = (document) => listener(document)
        this.on('document-opened', handler)
        return new Disposable(() => this.off('document-opened', handler))
    }

    /**
     * Listen to document close events
     */
    onDidCloseTextDocument(listener) {
        const handler = (document) => listener(document)
        this.on('document-closed', handler)
        return new Disposable(() => this.off('document-closed', handler))
    }

    /**
     * Listen to document save events
     */
    onDidSaveTextDocument(listener) {
        const handler = (document) => listener(document)
        this.on('document-saved', handler)
        return new Disposable(() => this.off('document-saved', handler))
    }

    /**
     * Listen to text document changes
     */
    onDidChangeTextDocument(listener) {
        const handler = (event) => listener(event)
        this.on('document-changed', handler)
        return new Disposable(() => this.off('document-changed', handler))
    }

    /**
     * Listen to workspace folder changes
     */
    onDidChangeWorkspaceFolders(listener) {
        const handler = (event) => listener(event)
        this.on('workspace-folders-changed', handler)
        return new Disposable(() => this.off('workspace-folders-changed', handler))
    }
}
