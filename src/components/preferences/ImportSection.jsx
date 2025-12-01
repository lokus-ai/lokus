import React, { useState } from "react";
import ImportWizard from "../features/ImportWizard.jsx";

export default function ImportSection({ workspacePath }) {
    const [showImportWizard, setShowImportWizard] = useState(false);

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: 'rgb(var(--text))' }}>
                    Import Notes
                </h2>
                <p style={{ color: 'rgb(var(--muted))' }}>
                    Migrate your notes from other platforms
                </p>
            </div>

            <div className="space-y-4">
                {/* Obsidian */}
                <div className="p-4 border rounded-lg" style={{ borderColor: 'rgb(var(--border))' }}>
                    <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--text))' }}>
                        Obsidian
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'rgb(var(--muted))' }}>
                        Already compatible! Just open your Obsidian vault folder in Lokus.
                    </p>
                    <div className="px-3 py-2 rounded" style={{
                        background: 'rgb(var(--accent) / 0.1)',
                        color: 'rgb(var(--accent))',
                        fontSize: '14px'
                    }}>
                        ✨ No import needed - open vault directly!
                    </div>
                </div>

                {/* Logseq */}
                <div className="p-4 border rounded-lg" style={{ borderColor: 'rgb(var(--border))' }}>
                    <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--text))' }}>
                        Logseq
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'rgb(var(--muted))' }}>
                        Convert your Logseq graph to Lokus format with automatic outline and property conversion.
                    </p>
                    <button
                        onClick={() => setShowImportWizard(true)}
                        className="px-4 py-2 rounded hover:opacity-90 transition-opacity"
                        style={{
                            background: 'rgb(var(--accent))',
                            color: 'white'
                        }}
                    >
                        Import from Logseq
                    </button>
                </div>

                {/* Roam Research */}
                <div className="p-4 border rounded-lg" style={{ borderColor: 'rgb(var(--border))' }}>
                    <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--text))' }}>
                        Roam Research
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'rgb(var(--muted))' }}>
                        Import your Roam JSON export with full block reference resolution.
                    </p>
                    <button
                        onClick={() => setShowImportWizard(true)}
                        className="px-4 py-2 rounded hover:opacity-90 transition-opacity"
                        style={{
                            background: 'rgb(var(--accent))',
                            color: 'white'
                        }}
                    >
                        Import from Roam
                    </button>
                </div>

                {/* Documentation Link */}
                <div className="p-4 border rounded-lg" style={{
                    borderColor: 'rgb(var(--border))',
                    background: 'rgb(var(--bg))'
                }}>
                    <p className="text-sm" style={{ color: 'rgb(var(--muted))' }}>
                        📚 Read the full <a
                            href="https://github.com/lokus-ai/lokus/blob/main/docs/migration-guide.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'rgb(var(--accent))', textDecoration: 'underline' }}
                        >
                            Migration Guide
                        </a> for detailed instructions and troubleshooting.
                    </p>
                </div>
            </div>

            {/* Import Wizard Modal */}
            {showImportWizard && (
                <ImportWizard
                    onClose={() => setShowImportWizard(false)}
                    initialWorkspacePath={workspacePath}
                />
            )}
        </div>
    );
}
