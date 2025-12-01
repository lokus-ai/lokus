import React from "react";

function ConnectionStatus() {
    return (
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-app-muted">Connected</span>
        </div>
    );
}

export default function ConnectionsSettings() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold mb-4 text-app-text">Connections</h2>
                <p className="text-app-text-secondary mb-6">
                    Connect external services and manage integrations with your workspace.
                </p>
            </div>

            {/* Available Connections */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-app-text">Available Services</h3>
                <div className="grid grid-cols-2 gap-4">
                    {/* Gmail - Real connection */}
                    <div className="bg-app-panel border border-app-border rounded-lg p-4 hover:bg-app-panel/80 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white font-semibold">
                                    G
                                </div>
                                <div>
                                    <h4 className="font-medium text-app-text">Gmail</h4>
                                    <p className="text-xs text-app-text-secondary">Email integration</p>
                                </div>
                            </div>
                            <ConnectionStatus />
                        </div>
                    </div>

                    {/* Outlook - Disabled */}
                    <div className="bg-app-panel border border-app-border rounded-lg p-4 opacity-50 cursor-not-allowed">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold">
                                    O
                                </div>
                                <div>
                                    <h4 className="font-medium text-app-text-secondary">Outlook</h4>
                                    <p className="text-xs text-app-text-secondary">Coming soon</p>
                                </div>
                            </div>
                            <div className="w-3 h-3 bg-app-muted rounded-full"></div>
                        </div>
                    </div>

                    {/* Jira - Disabled */}
                    <div className="bg-app-panel border border-app-border rounded-lg p-4 opacity-50 cursor-not-allowed">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                    J
                                </div>
                                <div>
                                    <h4 className="font-medium text-app-text-secondary">Jira</h4>
                                    <p className="text-xs text-app-text-secondary">Coming soon</p>
                                </div>
                            </div>
                            <div className="w-3 h-3 bg-app-muted rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
