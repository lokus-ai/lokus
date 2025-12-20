import { useEffect, useState } from 'react';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { toast } from './use-toast';

/**
 * Hook to handle lokus:// deep links
 *
 * Supported URLs:
 * - lokus://install/{plugin-slug} - Install a plugin from the registry
 */
export function useDeepLink() {
    const [pendingInstall, setPendingInstall] = useState(null);

    useEffect(() => {
        let unlisten;

        const setupDeepLinkHandler = async () => {
            try {
                unlisten = await onOpenUrl((urls) => {
                    console.log('[DeepLink] Received URLs:', urls);

                    for (const urlString of urls) {
                        try {
                            // Handle both lokus:// and lokus: formats
                            const normalizedUrl = urlString.replace('lokus:', 'lokus://');
                            const url = new URL(normalizedUrl);

                            // Get the path (remove leading slashes)
                            const path = url.pathname.replace(/^\/+/, '') || url.host;

                            if (path.startsWith('install/') || url.host === 'install') {
                                // lokus://install/plugin-slug
                                const slug = path.replace('install/', '') || url.pathname.replace(/^\/+/, '');

                                if (slug) {
                                    console.log('[DeepLink] Install request for plugin:', slug);
                                    setPendingInstall(slug);

                                    // Dispatch event for plugin system to handle
                                    // The PluginProvider will listen for this and handle the actual installation
                                    window.dispatchEvent(new CustomEvent('plugin-install-from-registry', {
                                        detail: { slug }
                                    }));
                                }
                            } else {
                                console.log('[DeepLink] Unknown action:', path);
                            }
                        } catch (err) {
                            console.error('[DeepLink] Failed to parse URL:', urlString, err);
                        }
                    }
                });
            } catch (err) {
                console.error('[DeepLink] Failed to setup handler:', err);
            }
        };

        setupDeepLinkHandler();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    return { pendingInstall };
}

export default useDeepLink;
