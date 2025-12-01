import React, { useState, useEffect } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals, importThemeFile, exportTheme, getThemeTokens, saveThemeTokens, applyTokens } from "../../core/theme/manager.js";
import { Upload, Download, Save, RotateCcw } from "lucide-react";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";

export default function AppearanceSettings() {
    const [themes, setThemes] = useState([]);
    const [activeTheme, setActiveTheme] = useState("");
    const [themeTokens, setThemeTokens] = useState({});
    const [originalTokens, setOriginalTokens] = useState({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        async function loadData() {
            const available = await listAvailableThemes();
            setThemes(available);
            const visuals = await readGlobalVisuals();
            const themeId = visuals.theme || "";
            setActiveTheme(themeId);

            // Load theme tokens for the initially selected theme
            if (themeId) {
                try {
                    const tokens = await getThemeTokens(themeId);
                    setThemeTokens(tokens);
                    setOriginalTokens(tokens);
                    setHasUnsavedChanges(false);
                } catch (error) {
                    console.error('Failed to load initial theme tokens:', error);
                }
            }
        }
        loadData().catch(() => { });
    }, []);

    // Listen for theme changes from other windows
    useEffect(() => {
        const handleThemeUpdate = (e) => {
            const data = e.detail || e.payload || {};
            if (data.visuals?.theme !== undefined) {
                setActiveTheme(data.visuals.theme || "");
            }
        };

        // Listen for both DOM events (browser) and theme:apply events
        window.addEventListener('theme:apply', handleThemeUpdate);

        return () => {
            window.removeEventListener('theme:apply', handleThemeUpdate);
        };
    }, []);

    const handleThemeChange = async (e) => {
        const themeId = e.target.value;
        setActiveTheme(themeId);
        await setGlobalActiveTheme(themeId).catch(() => { });

        // Load theme tokens for editing
        if (themeId) {
            try {
                const tokens = await getThemeTokens(themeId);
                setThemeTokens(tokens);
                setOriginalTokens(tokens);
                setHasUnsavedChanges(false);
            } catch (error) {
                console.error('Failed to load theme tokens:', error);
                setThemeTokens({});
                setOriginalTokens({});
            }
        } else {
            setThemeTokens({});
            setOriginalTokens({});
        }
    };

    const handleUploadTheme = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Theme',
                    extensions: ['json']
                }]
            });

            if (!selected) return;

            const themeId = await importThemeFile(selected, false);

            // Refresh theme list
            const available = await listAvailableThemes();
            setThemes(available);

            // Switch to the new theme
            setActiveTheme(themeId);
            await setGlobalActiveTheme(themeId);

            // Load tokens
            const tokens = await getThemeTokens(themeId);
            setThemeTokens(tokens);
            setOriginalTokens(tokens);
            setHasUnsavedChanges(false);

            alert('Theme imported successfully!');
        } catch (error) {
            alert(`Failed to import theme: ${error.message}`);
        }
    };

    const handleExportTheme = async () => {
        if (!activeTheme) {
            alert('Please select a theme first');
            return;
        }

        try {
            const themeName = themes.find(t => t.id === activeTheme)?.name || activeTheme;
            const filePath = await saveDialog({
                defaultPath: `${themeName}.json`,
                filters: [{
                    name: 'Theme',
                    extensions: ['json']
                }]
            });

            if (!filePath) return;

            await exportTheme(activeTheme, filePath);
            alert('Theme exported successfully!');
        } catch (error) {
            alert(`Failed to export theme: ${error.message}`);
        }
    };

    const handleTokenChange = (tokenKey, newValue) => {
        const updatedTokens = { ...themeTokens, [tokenKey]: newValue };
        setThemeTokens(updatedTokens);
        setHasUnsavedChanges(true);

        // Live preview: apply changes immediately
        applyTokens(updatedTokens);
    };

    const handleSaveTheme = async () => {
        if (!activeTheme) {
            alert('Please select a theme first');
            return;
        }

        try {
            await saveThemeTokens(activeTheme, themeTokens);
            setOriginalTokens(themeTokens);
            setHasUnsavedChanges(false);
            alert('Theme saved successfully!');
        } catch (error) {
            alert(`Failed to save theme: ${error.message}`);
        }
    };

    const handleResetTheme = () => {
        setThemeTokens(originalTokens);
        setHasUnsavedChanges(false);
        applyTokens(originalTokens);
    };

    return (
        <div className="space-y-8 max-w-xl">
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm uppercase tracking-wide text-app-muted">Theme</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleUploadTheme}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-app-panel border border-app-border hover:bg-app-bg transition-colors"
                            title="Upload theme file"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Upload
                        </button>
                        <button
                            onClick={handleExportTheme}
                            disabled={!activeTheme}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-app-panel border border-app-border hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export current theme"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                    </div>
                </div>

                <select
                    className="h-9 px-3 w-full rounded-md bg-app-panel border border-app-border outline-none mb-4"
                    value={activeTheme}
                    onChange={handleThemeChange}
                >
                    <option value="">Built-in</option>
                    {themes.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                            {theme.name}
                        </option>
                    ))}
                </select>

                {/* Theme Editor Table */}
                {activeTheme && Object.keys(themeTokens).length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-app-muted">
                                Edit colors and save changes to the theme file
                            </p>
                            <div className="flex items-center gap-2">
                                {hasUnsavedChanges && (
                                    <button
                                        onClick={handleResetTheme}
                                        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:bg-app-panel transition-colors text-app-muted"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Reset
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveTheme}
                                    disabled={!hasUnsavedChanges}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-app-accent text-app-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Save Changes
                                </button>
                            </div>
                        </div>

                        <div className="border border-app-border rounded-md overflow-hidden">
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-app-panel sticky top-0">
                                        <tr>
                                            <th className="text-left px-3 py-2 text-xs font-medium text-app-muted uppercase tracking-wide">Token</th>
                                            <th className="text-left px-3 py-2 text-xs font-medium text-app-muted uppercase tracking-wide w-16">Preview</th>
                                            <th className="text-left px-3 py-2 text-xs font-medium text-app-muted uppercase tracking-wide">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(themeTokens).sort().map(([key, value]) => {
                                            const rgbValue = value.includes(' ') ? `rgb(${value})` : value;
                                            return (
                                                <tr key={key} className="border-t border-app-border hover:bg-app-panel/50">
                                                    <td className="px-3 py-2 font-mono text-xs text-app-muted">{key}</td>
                                                    <td className="px-3 py-2">
                                                        <div
                                                            className="w-8 h-8 rounded border border-app-border"
                                                            style={{ backgroundColor: rgbValue }}
                                                            title={rgbValue}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={value}
                                                            onChange={(e) => handleTokenChange(key, e.target.value)}
                                                            className="w-full px-2 py-1 text-xs font-mono rounded bg-app-bg border border-app-border outline-none focus:border-app-accent"
                                                            placeholder="e.g., 255 128 0 or #ff8000"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {!activeTheme && (
                    <p className="text-xs text-app-muted mt-2">
                        Select a theme to edit its colors
                    </p>
                )}
            </section>
        </div>
    );
}
