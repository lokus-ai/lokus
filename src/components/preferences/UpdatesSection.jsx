import React from "react";

export default function UpdatesSection() {
    return (
        <div className="space-y-8 max-w-xl">
            <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-4">App Updates</h2>

                <div className="bg-app-panel rounded-lg p-4 border border-app-border">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="font-medium mb-1">Current Version</h3>
                            <p className="text-2xl font-semibold text-app-accent">v1.3.3</p>
                        </div>
                    </div>

                    <button
                        onClick={() => window.dispatchEvent(new Event('check-for-update'))}
                        className="w-full px-4 py-2 bg-app-accent text-app-accent-fg rounded-md hover:opacity-90 transition-opacity"
                    >
                        Check for Updates
                    </button>

                    <p className="mt-4 text-sm text-app-muted">
                        Lokus automatically checks for updates in the background. Click the button above to check manually.
                    </p>
                </div>
            </section>
        </div>
    );
}
