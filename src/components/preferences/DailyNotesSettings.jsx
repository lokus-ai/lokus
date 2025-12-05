import React, { useState, useEffect } from "react";
import { readConfig, updateConfig } from "../../core/config/store.js";

export default function DailyNotesSettings() {
    const [dailyNotesSettings, setDailyNotesSettings] = useState({
        format: 'yyyy-MM-dd',
        folder: 'Daily Notes',
        template: '# {{date}}\n\n## Tasks\n- \n\n## Notes\n',
        openOnStartup: false
    });

    useEffect(() => {
        async function loadData() {
            try {
                const cfg = await readConfig();
                if (cfg.dailyNotes) {
                    setDailyNotesSettings(prev => ({ ...prev, ...cfg.dailyNotes }));
                }
            } catch (e) {
                console.error('Failed to load daily notes settings:', e);
            }
        }
        loadData();
    }, []);

    const saveDailyNotesSettings = async () => {
        try {
            await updateConfig({ dailyNotes: dailyNotesSettings });
        } catch (e) {
            console.error('Failed to save daily notes settings:', e);
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Daily Notes</h2>
                <p className="text-app-muted">Configure your daily journaling workflow with customizable templates and date formats.</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Date Format</label>
                    <input
                        type="text"
                        className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none focus:border-app-accent"
                        value={dailyNotesSettings.format}
                        onChange={(e) => setDailyNotesSettings({ ...dailyNotesSettings, format: e.target.value })}
                        onBlur={saveDailyNotesSettings}
                        placeholder="yyyy-MM-dd"
                    />
                    <p className="text-xs text-app-muted mt-1">
                        Uses date-fns format. Examples: yyyy-MM-dd, MM-dd-yyyy, yyyy/MM/dd
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Folder Location</label>
                    <input
                        type="text"
                        className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none focus:border-app-accent"
                        value={dailyNotesSettings.folder}
                        onChange={(e) => setDailyNotesSettings({ ...dailyNotesSettings, folder: e.target.value })}
                        onBlur={saveDailyNotesSettings}
                        placeholder="Daily Notes"
                    />
                    <p className="text-xs text-app-muted mt-1">
                        Folder path relative to your workspace root
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Daily Note Template</label>
                    <textarea
                        className="w-full h-32 px-3 py-2 rounded-md bg-app-panel border border-app-border outline-none focus:border-app-accent resize-y font-mono text-sm"
                        value={dailyNotesSettings.template}
                        onChange={(e) => setDailyNotesSettings({ ...dailyNotesSettings, template: e.target.value })}
                        onBlur={saveDailyNotesSettings}
                        placeholder="# {{date}}&#10;&#10;## Tasks&#10;- &#10;&#10;## Notes&#10;"
                    />
                    <div className="text-xs text-app-muted mt-2 space-y-1">
                        <p className="font-medium">Available template variables:</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-2">
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{date}}'}</code> - Today's date</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{yesterday}}'}</code> - Yesterday's date</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{tomorrow}}'}</code> - Tomorrow's date</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{day}}'}</code> - Day name (Monday)</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{day_short}}'}</code> - Day name (Mon)</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{month}}'}</code> - Month name</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{week}}'}</code> - Week number</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{year}}'}</code> - Year (2025)</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{time}}'}</code> - Current time</div>
                            <div><code className="px-1 py-0.5 bg-app-bg rounded text-xs">{'{{date:FORMAT}}'}</code> - Custom format</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 py-2">
                    <input
                        type="checkbox"
                        id="openOnStartup"
                        className="w-4 h-4 rounded border-app-border"
                        checked={dailyNotesSettings.openOnStartup}
                        onChange={(e) => {
                            setDailyNotesSettings({ ...dailyNotesSettings, openOnStartup: e.target.checked });
                            saveDailyNotesSettings();
                        }}
                    />
                    <label htmlFor="openOnStartup" className="text-sm cursor-pointer">
                        Open today's daily note on startup
                    </label>
                </div>

                <div className="pt-4 border-t border-app-border">
                    <p className="text-sm text-app-muted mb-2">Quick access:</p>
                    <ul className="text-sm space-y-1 text-app-muted">
                        <li>• Press <kbd className="px-2 py-0.5 bg-app-bg border border-app-border rounded text-xs">Cmd/Ctrl + Shift + D</kbd> to open today's note</li>
                        <li>• Use Command Palette (Cmd/Ctrl + K) → "Open Daily Note"</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
