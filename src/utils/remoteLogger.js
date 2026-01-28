/**
 * Remote Logger - Sends ALL JS logs to dev machine via Rust UDP
 */
class RemoteLogger {
    constructor() {
        this.originalConsole = {};
        this.enabled = false;
        this.invoke = null;
    }

    async init() {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            this.invoke = invoke;

            // Initialize the Rust UDP logger with the dev server host
            // On iOS, window.location might be localhost due to Tauri proxying
            // Try multiple sources to find the actual dev machine IP
            let host = window.location.hostname;

            // If localhost, try to get from Vite's env or tauri internals
            if (host === 'localhost' || host === '127.0.0.1') {
                // Check if VITE set the host through env
                host = import.meta.env.VITE_LOG_SERVER_HOST || null;

                // Try to get from __TAURI_INTERNALS__ if available
                if (!host && window.__TAURI_INTERNALS__?.metadata?.currentWebview?.url) {
                    try {
                        const url = new URL(window.__TAURI_INTERNALS__.metadata.currentWebview.url);
                        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                            host = url.hostname;
                        }
                    } catch {}
                }

                // If still no host, try fetching our own origin
                if (!host) {
                    // Fall back - check if we're on iOS by looking for the Tauri mobile patterns
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobile) {
                        console.warn('[RemoteLogger] Could not detect dev server IP. Set VITE_LOG_SERVER_HOST in .env');
                    }
                }
            }

            if (host && host !== 'localhost' && host !== '127.0.0.1') {
                await invoke('remote_log_init', { host });
            }
        } catch {
            return; // Not in Tauri environment
        }

        // Store originals
        ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
            this.originalConsole[method] = console[method].bind(console);
        });

        this._interceptConsole();
        this.enabled = true;
        this._send('info', '[RemoteLogger] Initialized');
    }

    _interceptConsole() {
        const self = this;
        ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
            console[method] = function(...args) {
                self.originalConsole[method](...args);
                if (self.enabled) {
                    const msg = args.map(a => {
                        if (a === null) return 'null';
                        if (a === undefined) return 'undefined';
                        if (a instanceof Error) return `${a.message}\n${a.stack}`;
                        if (typeof a === 'object') {
                            try { return JSON.stringify(a); } catch { return String(a); }
                        }
                        return String(a);
                    }).join(' ');
                    self._send(method, msg);
                }
            };
        });

        window.addEventListener('error', (e) => {
            this._send('error', `[UNCAUGHT] ${e.message} at ${e.filename}:${e.lineno}`);
        });

        window.addEventListener('unhandledrejection', (e) => {
            this._send('error', `[UNHANDLED] ${e.reason}`);
        });
    }

    _send(level, message) {
        if (this.invoke) {
            this.invoke('remote_log', { level, message }).catch(() => {});
        }
    }
}

export const remoteLogger = new RemoteLogger();
export default remoteLogger;
