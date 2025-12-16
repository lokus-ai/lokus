import React, { useState, useEffect, useCallback } from 'react';
import { RegistryAPI } from '../plugins/registry/RegistryAPI';
import { usePlugins } from '../hooks/usePlugins';
import { logger } from '../utils/logger';

const registry = new RegistryAPI();

export default function Marketplace() {
    const { plugins, installPlugin, uninstallPlugin, installingPlugins } = usePlugins();
    const [searchQuery, setSearchQuery] = useState('');
    const [registryPlugins, setRegistryPlugins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPlugins = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await registry.searchPlugins(searchQuery);
            setRegistryPlugins(results);
        } catch (err) {
            logger.error('Failed to fetch plugins from registry:', err);
            setError('Failed to connect to plugin marketplace');
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        const debounce = setTimeout(fetchPlugins, 500);
        return () => clearTimeout(debounce);
    }, [fetchPlugins]);

    const handleInstall = async (pluginId, version) => {
        try {
            // Use the new install flow via PluginStateAdapter -> PluginLoader
            await installPlugin(pluginId, {
                version,
                fromMarketplace: true
            });

        } catch (err) {
            logger.error(`Failed to install plugin ${pluginId}:`, err);
            // Error is handled by usePlugins/PluginStateAdapter
        }
    };

    const isInstalled = (pluginId) => {
        return plugins.some(p => p.id === pluginId);
    };

    const isInstalling = (pluginId) => {
        return installingPlugins.has(pluginId);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Plugin Marketplace</h1>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search plugins..."
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 w-64 focus:outline-none focus:border-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {registryPlugins.map(plugin => (
                            <div key={plugin.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">{plugin.name}</h3>
                                        <p className="text-zinc-400 text-sm">v{plugin.version}</p>
                                    </div>
                                    {plugin.icon && (
                                        <img src={plugin.icon} alt={plugin.name} className="w-10 h-10 rounded-lg" />
                                    )}
                                </div>

                                <p className="text-zinc-300 text-sm mb-6 flex-1 line-clamp-3">
                                    {plugin.description}
                                </p>

                                <div className="flex items-center justify-between mt-auto">
                                    <div className="text-xs text-zinc-500">
                                        by {plugin.author}
                                    </div>

                                    {isInstalled(plugin.id) ? (
                                        <button
                                            onClick={() => uninstallPlugin(plugin.id)}
                                            disabled={isInstalling(plugin.id)}
                                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {isInstalling(plugin.id) ? 'Uninstalling...' : 'Uninstall'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleInstall(plugin.id, plugin.version)}
                                            disabled={isInstalling(plugin.id)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {isInstalling(plugin.id) ? 'Installing...' : 'Install'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {registryPlugins.length === 0 && !loading && !error && (
                            <div className="col-span-full text-center py-12 text-zinc-500">
                                No plugins found. Try a different search term.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
