import { useEffect, useState } from 'react';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { invoke } from '@tauri-apps/api/core';

const PENDING_TEAM_INVITE_KEY = 'pending-team-invite';

/**
 * Hook to handle lokus:// deep links
 *
 * Supported URLs:
 * - lokus://install/{plugin-slug} - Install a plugin from the registry
 * - lokus://team-invite?invite_id={id}&token={token} - Join an encrypted team
 */
export function useDeepLink() {
    const [pendingInstall, setPendingInstall] = useState(null);
    const [pendingTeamInvite, setPendingTeamInvite] = useState(null);

    useEffect(() => {
        let unlisten;

        const setupDeepLinkHandler = async () => {
            try {
                unlisten = await onOpenUrl((urls) => {
                    console.log(`[DeepLink] Received ${urls.length} URL${urls.length === 1 ? '' : 's'}`);

                    for (const urlString of urls) {
                        try {
                            const parsed = parseLokusDeepLink(urlString);
                            if (parsed.type === 'plugin-install') {
                                // lokus://install/plugin-slug
                                console.log('[DeepLink] Install request for plugin:', parsed.slug);
                                setPendingInstall(parsed.slug);

                                // Dispatch event for plugin system to handle
                                // The PluginProvider will listen for this and handle the actual installation
                                window.dispatchEvent(new CustomEvent('plugin-install-from-registry', {
                                    detail: { slug: parsed.slug }
                                }));
                            } else if (parsed.type === 'team-invite') {
                                setPendingTeamInvite({
                                    inviteId: parsed.inviteId,
                                    token: parsed.token,
                                });
                                void storeAndOpenTeamInvite(parsed).catch((error) => {
                                    console.error(
                                        '[DeepLink] Could not open team invite:',
                                        error?.message || error,
                                    );
                                });
                            }
                        } catch (err) {
                            console.error('[DeepLink] Failed to handle URL:', err?.message || err);
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

    return { pendingInstall, pendingTeamInvite };
}

export function parseLokusDeepLink(urlString) {
    if (typeof urlString !== 'string' || !urlString.startsWith('lokus:')) {
        throw new Error('Unsupported deep link');
    }
    const normalizedUrl = urlString.startsWith('lokus://')
        ? urlString
        : urlString.replace(/^lokus:/, 'lokus://');
    const url = new URL(normalizedUrl);
    const path = url.pathname.replace(/^\/+/, '');
    const action = url.host || path.split('/')[0];

    if (action === 'install') {
        const slug = url.host === 'install'
            ? path
            : path.replace(/^install\//, '');
        if (!slug) throw new Error('Plugin install link is missing a slug');
        return { type: 'plugin-install', slug };
    }

    if (action === 'team-invite') {
        const inviteId = url.searchParams.get('invite_id');
        const token = url.searchParams.get('token');
        if (!inviteId || !token) throw new Error('Team invite link is incomplete');
        return { type: 'team-invite', inviteId, token };
    }

    throw new Error('Unknown deep link action');
}

async function storeAndOpenTeamInvite({ inviteId, token }) {
    await invoke('secure_store_set', {
        key: PENDING_TEAM_INVITE_KEY,
        value: JSON.stringify({ inviteId, token }),
    });
    await invoke('open_preferences_window', {
        workspacePath: globalThis.__WORKSPACE_PATH__ ?? null,
        section: 'Teams',
    });
}

export default useDeepLink;
