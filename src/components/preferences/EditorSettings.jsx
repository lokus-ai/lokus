import React, { useState, useEffect } from "react";
import liveEditorSettings from "../../core/editor/live-settings.js";
import { updateConfig, readConfig } from "../../core/config/store.js";

export default function EditorSettings() {
    const [liveSettings, setLiveSettings] = useState(liveEditorSettings.getAllSettings());
    const [saveStatus, setSaveStatus] = useState('');

    const [expandedSections, setExpandedSections] = useState({
        font: true,
        colors: false,
        spacing: false,
        typography: false,
        codeBlocks: false,
        lists: false,
        links: false,
        decorations: false,
        blockquotes: false,
        tables: false,
        presets: false
    });

    const [editorSettings, setEditorSettings] = useState({
        font: {
            family: 'ui-sans-serif',
            size: 16,
            lineHeight: 1.7,
            letterSpacing: 0.003
        },
        typography: {
            h1Size: 2.0,
            h2Size: 1.6,
            h3Size: 1.3,
            headingColor: 'inherit',
            codeBlockTheme: 'default',
            linkColor: 'rgb(var(--accent))'
        },
        behavior: {
            autoPairBrackets: true,
            smartQuotes: false,
            autoIndent: true,
            wordWrap: true,
            showLineNumbers: false
        },
        appearance: {
            showMarkdown: false,
            focusMode: false,
            typewriterMode: false
        }
    });

    // Subscribe to live settings changes
    useEffect(() => {
        const unsubscribe = liveEditorSettings.onSettingsChange(() => {
            setLiveSettings(liveEditorSettings.getAllSettings());
        });
        return unsubscribe;
    }, []);

    // Load editor settings
    useEffect(() => {
        async function loadData() {
            try {
                const cfg = await readConfig();
                if (cfg.editor) {
                    setEditorSettings(prev => ({
                        font: { ...prev.font, ...cfg.editor.font },
                        typography: { ...prev.typography, ...cfg.editor.typography },
                        behavior: { ...prev.behavior, ...cfg.editor.behavior },
                        appearance: { ...prev.appearance, ...cfg.editor.appearance }
                    }));
                }
            } catch (e) {
                console.error('Failed to load editor settings:', e);
            }
        }
        loadData();
    }, []);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Preset themes for quick styling
    const presets = {
        minimal: {
            fontSize: 16,
            lineHeight: 1.8,
            letterSpacing: 0,
            paragraphSpacing: 1.5,
            h1Size: 1.8,
            h2Size: 1.5,
            h3Size: 1.2,
            fontWeight: 400,
            boldWeight: 600
        },
        comfortable: {
            fontSize: 17,
            lineHeight: 1.7,
            letterSpacing: 0.003,
            paragraphSpacing: 1.2,
            h1Size: 2.0,
            h2Size: 1.6,
            h3Size: 1.3,
            fontWeight: 400,
            boldWeight: 700
        },
        compact: {
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: -0.01,
            paragraphSpacing: 0.8,
            h1Size: 1.6,
            h2Size: 1.4,
            h3Size: 1.2,
            fontWeight: 400,
            boldWeight: 600
        },
        spacious: {
            fontSize: 18,
            lineHeight: 2.0,
            letterSpacing: 0.01,
            paragraphSpacing: 2,
            h1Size: 2.4,
            h2Size: 1.9,
            h3Size: 1.5,
            fontWeight: 300,
            boldWeight: 600
        }
    };

    const applyPreset = (presetName) => {
        const preset = presets[presetName];
        if (preset) {
            Object.keys(preset).forEach(key => {
                liveEditorSettings.updateSetting(key, preset[key]);
            });
        }
    };

    const saveEditorSettings = async () => {
        try {
            setSaveStatus('saving');

            // Get all current settings from liveEditorSettings
            const currentSettings = liveEditorSettings.getAllSettings();

            // Save to global config (this actually works and persists)
            await updateConfig({ editorSettings: currentSettings });

            setSaveStatus('success');
            setTimeout(() => setSaveStatus(''), 3000);
        } catch (e) {
            console.error('Failed to save editor settings:', e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(''), 3000);
        }
    };

    const resetEditorSettings = () => {
        // Reset live settings to defaults
        liveEditorSettings.reset();

        // Also update the local state (though not really used)
        const defaultSettings = {
            font: {
                family: 'ui-sans-serif',
                size: 16,
                lineHeight: 1.7,
                letterSpacing: 0.003
            },
            typography: {
                h1Size: 2.0,
                h2Size: 1.6,
                h3Size: 1.3,
                headingColor: 'inherit',
                codeBlockTheme: 'default',
                linkColor: 'rgb(var(--accent))'
            },
            behavior: {
                autoPairBrackets: true,
                smartQuotes: false,
                autoIndent: true,
                wordWrap: true,
                showLineNumbers: false
            },
            appearance: {
                showMarkdown: false,
                focusMode: false,
                typewriterMode: false
            }
        };
        setEditorSettings(defaultSettings);

        // Force UI to update by triggering a re-render
        setLiveSettings(liveEditorSettings.getAllSettings());
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl">
            {/* Settings Controls */}
            <div className="flex-1 space-y-2 min-w-0">
                {/* Style Presets */}
                <section className="border border-app-border rounded-lg overflow-hidden bg-app-panel/30 hover:border-app-accent/30 transition-all">
                    <button
                        onClick={() => toggleSection('presets')}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-app-panel/50 to-transparent hover:from-app-panel flex items-center justify-between transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                            </svg>
                            <h2 className="text-sm font-semibold">Quick Presets</h2>
                        </div>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSections.presets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.presets && (
                        <div className="p-4 bg-app-bg/50 backdrop-blur-sm">
                            <p className="text-xs text-app-muted mb-3">Choose a preset to quickly apply professional styling</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => applyPreset('minimal')}
                                    className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                                >
                                    <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Minimal</div>
                                    <div className="text-xs text-app-muted">Clean & simple</div>
                                </button>
                                <button
                                    onClick={() => applyPreset('comfortable')}
                                    className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                                >
                                    <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Comfortable</div>
                                    <div className="text-xs text-app-muted">Balanced & easy</div>
                                </button>
                                <button
                                    onClick={() => applyPreset('compact')}
                                    className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                                >
                                    <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Compact</div>
                                    <div className="text-xs text-app-muted">Dense & efficient</div>
                                </button>
                                <button
                                    onClick={() => applyPreset('spacious')}
                                    className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                                >
                                    <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Spacious</div>
                                    <div className="text-xs text-app-muted">Airy & relaxed</div>
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Font Settings - Real-time */}
                <section className="border border-app-border rounded-lg overflow-hidden bg-app-panel/30 hover:border-app-accent/30 transition-all">
                    <button
                        onClick={() => toggleSection('font')}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-app-panel/50 to-transparent hover:from-app-panel flex items-center justify-between transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            <h2 className="text-sm font-semibold">Font & Typography</h2>
                        </div>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSections.font ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.font && (
                        <div className="p-4 space-y-4 bg-app-bg/50 backdrop-blur-sm">
                            <div>
                                <label className="block text-sm font-medium mb-2">Font Family</label>
                                <select
                                    className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                                    value={liveEditorSettings.getSetting('fontFamily')}
                                    onChange={async (e) => {
                                        liveEditorSettings.updateSetting('fontFamily', e.target.value);
                                        await updateConfig({ editor: { ...editorSettings, font: { ...editorSettings.font, family: e.target.value } } });
                                    }}
                                >
                                    <option value="ui-sans-serif">System UI</option>
                                    <option value="ui-serif">System Serif</option>
                                    <option value="ui-monospace">System Monospace</option>
                                    <option value="Inter">Inter</option>
                                    <option value="Roboto">Roboto</option>
                                    <option value="'Helvetica Neue', Helvetica">Helvetica</option>
                                    <option value="Georgia, serif">Georgia</option>
                                    <option value="'Times New Roman', serif">Times New Roman</option>
                                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-app-muted uppercase tracking-wide">Font Size</label>
                                    <span className="text-xs font-mono text-app-accent bg-app-accent/10 px-2 py-0.5 rounded">{liveEditorSettings.getSetting('fontSize')}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="12"
                                    max="24"
                                    step="1"
                                    className="w-full h-2 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                    value={liveEditorSettings.getSetting('fontSize')}
                                    onChange={(e) => liveEditorSettings.updateSetting('fontSize', parseInt(e.target.value))}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-app-muted uppercase tracking-wide">Line Height</label>
                                    <span className="text-xs font-mono text-app-accent bg-app-accent/10 px-2 py-0.5 rounded">{liveEditorSettings.getSetting('lineHeight')}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1.2"
                                    max="2.5"
                                    step="0.1"
                                    className="w-full h-2 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                    value={liveEditorSettings.getSetting('lineHeight')}
                                    onChange={(e) => liveEditorSettings.updateSetting('lineHeight', parseFloat(e.target.value))}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-app-muted uppercase tracking-wide">Letter Spacing</label>
                                    <span className="text-xs font-mono text-app-accent bg-app-accent/10 px-2 py-0.5 rounded">{liveEditorSettings.getSetting('letterSpacing')}em</span>
                                </div>
                                <input
                                    type="range"
                                    min="-0.05"
                                    max="0.1"
                                    step="0.005"
                                    className="w-full h-2 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                    value={liveEditorSettings.getSetting('letterSpacing')}
                                    onChange={(e) => liveEditorSettings.updateSetting('letterSpacing', parseFloat(e.target.value))}
                                />
                            </div>

                            <div className="border-t border-app-border/50 pt-4 mt-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-app-accent rounded-full"></div>
                                    Heading Sizes
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium text-app-muted">H1</label>
                                            <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('h1Size')}em</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1.5"
                                            max="3.0"
                                            step="0.1"
                                            className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                            value={liveEditorSettings.getSetting('h1Size')}
                                            onChange={(e) => liveEditorSettings.updateSetting('h1Size', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium text-app-muted">H2</label>
                                            <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('h2Size')}em</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1.2"
                                            max="2.5"
                                            step="0.1"
                                            className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                            value={liveEditorSettings.getSetting('h2Size')}
                                            onChange={(e) => liveEditorSettings.updateSetting('h2Size', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium text-app-muted">H3</label>
                                            <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('h3Size')}em</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1.0"
                                            max="2.0"
                                            step="0.1"
                                            className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                            value={liveEditorSettings.getSetting('h3Size')}
                                            onChange={(e) => liveEditorSettings.updateSetting('h3Size', parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-app-border/50 pt-4 mt-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-app-accent rounded-full"></div>
                                    Font Weights
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium text-app-muted">Normal</label>
                                            <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('fontWeight')}</span>
                                        </div>
                                        <input type="range" min="100" max="900" step="100"
                                            className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                                            value={liveEditorSettings.getSetting('fontWeight')}
                                            onChange={(e) => liveEditorSettings.updateSetting('fontWeight', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Bold</label>
                                        <div className="flex items-center gap-2">
                                            <input type="range" min="100" max="900" step="100" className="flex-1"
                                                value={liveEditorSettings.getSetting('boldWeight')}
                                                onChange={(e) => liveEditorSettings.updateSetting('boldWeight', parseInt(e.target.value))}
                                            />
                                            <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('boldWeight')}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">H1</label>
                                        <div className="flex items-center gap-2">
                                            <input type="range" min="100" max="900" step="100" className="flex-1"
                                                value={liveEditorSettings.getSetting('h1Weight')}
                                                onChange={(e) => liveEditorSettings.updateSetting('h1Weight', parseInt(e.target.value))}
                                            />
                                            <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('h1Weight')}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">H2</label>
                                        <div className="flex items-center gap-2">
                                            <input type="range" min="100" max="900" step="100" className="flex-1"
                                                value={liveEditorSettings.getSetting('h2Weight')}
                                                onChange={(e) => liveEditorSettings.updateSetting('h2Weight', parseInt(e.target.value))}
                                            />
                                            <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('h2Weight')}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">H3</label>
                                        <div className="flex items-center gap-2">
                                            <input type="range" min="100" max="900" step="100" className="flex-1"
                                                value={liveEditorSettings.getSetting('h3Weight')}
                                                onChange={(e) => liveEditorSettings.updateSetting('h3Weight', parseInt(e.target.value))}
                                            />
                                            <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('h3Weight')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Spacing Settings */}
                <section className="border border-app-border rounded-lg overflow-hidden bg-app-panel/30 hover:border-app-accent/30 transition-all">
                    <button
                        onClick={() => toggleSection('spacing')}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-app-panel/50 to-transparent hover:from-app-panel flex items-center justify-between transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            <h2 className="text-sm font-semibold">Spacing & Layout</h2>
                        </div>
                        <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSections.spacing ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.spacing && (
                        <div className="p-4 space-y-4 bg-app-bg">
                            <div>
                                <label className="block text-sm font-medium mb-2">Paragraph Spacing</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="3"
                                        step="0.25"
                                        className="flex-1"
                                        value={liveEditorSettings.getSetting('paragraphSpacing')}
                                        onChange={(e) => liveEditorSettings.updateSetting('paragraphSpacing', parseFloat(e.target.value))}
                                    />
                                    <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('paragraphSpacing')}rem</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">List Item Spacing</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        className="flex-1"
                                        value={liveEditorSettings.getSetting('listSpacing')}
                                        onChange={(e) => liveEditorSettings.updateSetting('listSpacing', parseFloat(e.target.value))}
                                    />
                                    <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('listSpacing')}rem</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Indentation Size</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="1"
                                        max="4"
                                        step="0.5"
                                        className="flex-1"
                                        value={liveEditorSettings.getSetting('indentSize')}
                                        onChange={(e) => liveEditorSettings.updateSetting('indentSize', parseFloat(e.target.value))}
                                    />
                                    <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('indentSize')}rem</span>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* List Symbols */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('lists')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">List Symbols</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.lists ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.lists && (
                        <div className="p-4 space-y-4 bg-app-bg">
                            <div>
                                <label className="block text-sm font-medium mb-2">Bullet Style</label>
                                <div className="flex gap-2">
                                    {['•', '◦', '▪', '▸', '►', '○', '●'].map(symbol => (
                                        <button
                                            key={symbol}
                                            onClick={() => liveEditorSettings.updateSetting('bulletStyle', symbol)}
                                            className={`w-10 h-10 flex items-center justify-center rounded border transition-colors ${liveEditorSettings.getSetting('bulletStyle') === symbol
                                                    ? 'border-app-accent bg-app-accent/10 text-app-accent'
                                                    : 'border-app-border hover:border-app-accent/50'
                                                }`}
                                        >
                                            {symbol}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Checkbox Style</label>
                                <div className="flex gap-2">
                                    {['☑', '✓', '✔', '☐', '✅'].map(symbol => (
                                        <button
                                            key={symbol}
                                            onClick={() => liveEditorSettings.updateSetting('checkboxStyle', symbol)}
                                            className={`w-10 h-10 flex items-center justify-center rounded border transition-colors ${liveEditorSettings.getSetting('checkboxStyle') === symbol
                                                    ? 'border-app-accent bg-app-accent/10 text-app-accent'
                                                    : 'border-app-border hover:border-app-accent/50'
                                                }`}
                                        >
                                            {symbol}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Colors */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('colors')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">Colors</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.colors ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.colors && (
                        <div className="p-4 bg-app-bg">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Text</label>
                                    <input
                                        type="color"
                                        className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('textColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('textColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('textColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Heading</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('headingColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('headingColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('headingColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Link</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('linkColor') === '#inherit' ? '#0000ff' : liveEditorSettings.getSetting('linkColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('linkColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Link Hover</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('linkHoverColor') === '#inherit' ? '#0000cc' : liveEditorSettings.getSetting('linkHoverColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('linkHoverColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Code</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('codeColor') === '#inherit' ? '#e83e8c' : liveEditorSettings.getSetting('codeColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('codeColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Code BG</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('codeBackground')}
                                        onChange={(e) => liveEditorSettings.updateSetting('codeBackground', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Quote</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('blockquoteColor') === '#inherit' ? '#6c757d' : liveEditorSettings.getSetting('blockquoteColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('blockquoteColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Quote Border</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('blockquoteBorder')}
                                        onChange={(e) => liveEditorSettings.updateSetting('blockquoteBorder', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Bold</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('boldColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('boldColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('boldColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Italic</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('italicColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('italicColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('italicColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Highlight BG</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('highlightColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('highlightColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Highlight Text</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('highlightTextColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('highlightTextColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('highlightTextColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Selection</label>
                                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('selectionColor').match(/#[0-9a-fA-F]{6}/)?.[0] || '#6366f1'}
                                        onChange={(e) => liveEditorSettings.updateSetting('selectionColor', `rgba(${parseInt(e.target.value.slice(1, 3), 16)}, ${parseInt(e.target.value.slice(3, 5), 16)}, ${parseInt(e.target.value.slice(5, 7), 16)}, 0.2)`)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Code Blocks */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('codeBlocks')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">Code Blocks</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.codeBlocks ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.codeBlocks && (
                        <div className="p-4 bg-app-bg">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Background Color</label>
                                    <input
                                        type="color"
                                        className="w-full h-10 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('codeBlockBg')}
                                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockBg', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Color</label>
                                    <input
                                        type="color"
                                        className="w-full h-10 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('codeBlockBorder')}
                                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockBorder', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Width</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('codeBlockBorderWidth')}
                                            onChange={(e) => liveEditorSettings.updateSetting('codeBlockBorderWidth', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockBorderWidth')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Radius</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="20"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('codeBlockBorderRadius')}
                                            onChange={(e) => liveEditorSettings.updateSetting('codeBlockBorderRadius', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockBorderRadius')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Padding</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="32"
                                            step="2"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('codeBlockPadding')}
                                            onChange={(e) => liveEditorSettings.updateSetting('codeBlockPadding', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockPadding')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Font Family</label>
                                    <select
                                        className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                                        value={liveEditorSettings.getSetting('codeBlockFont')}
                                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockFont', e.target.value)}
                                    >
                                        <option value="ui-monospace">System Monospace</option>
                                        <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                                        <option value="'Fira Code', monospace">Fira Code</option>
                                        <option value="'Source Code Pro', monospace">Source Code Pro</option>
                                        <option value="Consolas, monospace">Consolas</option>
                                        <option value="Monaco, monospace">Monaco</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Font Size</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="10"
                                            max="20"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('codeBlockFontSize')}
                                            onChange={(e) => liveEditorSettings.updateSetting('codeBlockFontSize', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockFontSize')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Line Height</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="1.0"
                                            max="2.0"
                                            step="0.1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('codeBlockLineHeight')}
                                            onChange={(e) => liveEditorSettings.updateSetting('codeBlockLineHeight', parseFloat(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-8">{liveEditorSettings.getSetting('codeBlockLineHeight')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Links */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('links')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">Links</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.links ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.links && (
                        <div className="p-4 bg-app-bg">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Underline Style</label>
                                    <select
                                        className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                                        value={liveEditorSettings.getSetting('linkUnderline')}
                                        onChange={(e) => liveEditorSettings.updateSetting('linkUnderline', e.target.value)}
                                    >
                                        <option value="none">None</option>
                                        <option value="hover">On Hover</option>
                                        <option value="always">Always</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Underline Thickness</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="1"
                                            max="4"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('linkUnderlineThickness')}
                                            onChange={(e) => liveEditorSettings.updateSetting('linkUnderlineThickness', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('linkUnderlineThickness')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Underline Offset</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="8"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('linkUnderlineOffset')}
                                            onChange={(e) => liveEditorSettings.updateSetting('linkUnderlineOffset', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('linkUnderlineOffset')}px</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Text Decorations */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('decorations')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">Text Decorations</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.decorations ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.decorations && (
                        <div className="p-4 bg-app-bg">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Strikethrough Color</label>
                                    <input
                                        type="color"
                                        className="w-full h-10 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('strikethroughColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('strikethroughColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Strikethrough Thickness</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="1"
                                            max="4"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('strikethroughThickness')}
                                            onChange={(e) => liveEditorSettings.updateSetting('strikethroughThickness', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('strikethroughThickness')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Underline Color</label>
                                    <input
                                        type="color"
                                        className="w-full h-10 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('underlineColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('underlineColor')}
                                        onChange={(e) => liveEditorSettings.updateSetting('underlineColor', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Underline Thickness</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="1"
                                            max="4"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('underlineThickness')}
                                            onChange={(e) => liveEditorSettings.updateSetting('underlineThickness', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('underlineThickness')}px</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Blockquotes */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('blockquotes')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">Blockquotes</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.blockquotes ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.blockquotes && (
                        <div className="p-4 bg-app-bg">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Width</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="1"
                                            max="8"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('blockquoteBorderWidth')}
                                            onChange={(e) => liveEditorSettings.updateSetting('blockquoteBorderWidth', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('blockquoteBorderWidth')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Padding</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="8"
                                            max="32"
                                            step="2"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('blockquotePadding')}
                                            onChange={(e) => liveEditorSettings.updateSetting('blockquotePadding', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('blockquotePadding')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Style</label>
                                    <select
                                        className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                                        value={liveEditorSettings.getSetting('blockquoteStyle')}
                                        onChange={(e) => liveEditorSettings.updateSetting('blockquoteStyle', e.target.value)}
                                    >
                                        <option value="solid">Solid</option>
                                        <option value="dashed">Dashed</option>
                                        <option value="dotted">Dotted</option>
                                        <option value="double">Double</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Tables */}
                <section className="border border-app-border rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection('tables')}
                        className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                    >
                        <h2 className="text-sm font-semibold uppercase tracking-wide">Tables</h2>
                        <svg className={`w-5 h-5 transition-transform ${expandedSections.tables ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {expandedSections.tables && (
                        <div className="p-4 bg-app-bg">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Color</label>
                                    <input
                                        type="color"
                                        className="w-full h-10 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('tableBorder')}
                                        onChange={(e) => liveEditorSettings.updateSetting('tableBorder', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Header Background</label>
                                    <input
                                        type="color"
                                        className="w-full h-10 rounded border border-app-border cursor-pointer"
                                        value={liveEditorSettings.getSetting('tableHeaderBg')}
                                        onChange={(e) => liveEditorSettings.updateSetting('tableHeaderBg', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Border Width</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="1"
                                            max="4"
                                            step="1"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('tableBorderWidth')}
                                            onChange={(e) => liveEditorSettings.updateSetting('tableBorderWidth', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('tableBorderWidth')}px</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Cell Padding</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="4"
                                            max="20"
                                            step="2"
                                            className="flex-1"
                                            value={liveEditorSettings.getSetting('tableCellPadding')}
                                            onChange={(e) => liveEditorSettings.updateSetting('tableCellPadding', parseInt(e.target.value))}
                                        />
                                        <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('tableCellPadding')}px</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Save Button */}
                <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-gradient-to-t from-app-bg via-app-bg to-transparent border-t border-app-border/50 py-4 backdrop-blur-sm">
                    <button
                        onClick={resetEditorSettings}
                        className="px-4 py-2 rounded-lg border border-app-border hover:bg-app-panel hover:border-app-accent/50 transition-all flex items-center gap-2 group"
                    >
                        <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reset
                    </button>
                    <button
                        onClick={saveEditorSettings}
                        className={`px-6 py-2 rounded-lg transition-all flex items-center gap-2 font-medium shadow-lg ${saveStatus === 'saving'
                                ? 'bg-app-muted text-app-bg cursor-wait'
                                : saveStatus === 'success'
                                    ? 'bg-green-600 text-white shadow-green-600/50'
                                    : saveStatus === 'error'
                                        ? 'bg-red-600 text-white shadow-red-600/50'
                                        : 'bg-app-accent text-white hover:bg-app-accent/90 hover:shadow-app-accent/50'
                            }`}
                    >
                        {saveStatus === 'saving' && (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {saveStatus === 'success' && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {saveStatus === 'error' && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                        {!saveStatus && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                        )}
                        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Failed' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {/* Live Preview - Sticky on the right */}
            <div className="lg:w-[400px] lg:sticky lg:top-6 self-start">
                <div className="border border-app-border rounded-xl p-4 bg-gradient-to-br from-app-panel/50 to-app-bg backdrop-blur-sm shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted">Live Preview</h3>
                    </div>
                    <div
                        className="ProseMirror min-h-[400px] max-h-[600px] overflow-y-auto p-4 bg-app-bg/80 rounded-lg border border-app-border/50 shadow-inner"
                        style={{
                            fontFamily: `var(--editor-font-family, ui-sans-serif)`,
                            fontSize: `var(--editor-font-size, 16px)`,
                            lineHeight: `var(--editor-line-height, 1.7)`,
                            letterSpacing: `var(--editor-letter-spacing, 0.003em)`,
                            color: `var(--editor-text-color, rgb(var(--text)))`
                        }}
                    >
                        <h1>Heading 1</h1>
                        <h2>Heading 2</h2>
                        <h3>Heading 3</h3>
                        <p>This is a paragraph with some <strong>bold text</strong> and <em>italic text</em>. You can see how your font settings affect the editor in real-time.</p>
                        <ul>
                            <li>Bullet point one</li>
                            <li>Bullet point two</li>
                            <li>Nested list:
                                <ul>
                                    <li>Nested item 1</li>
                                    <li>Nested item 2</li>
                                </ul>
                            </li>
                        </ul>
                        <p>Here's a <a href="#">link example</a> and some <code>inline code</code>.</p>
                        <blockquote>
                            <p>This is a blockquote to test quote styling.</p>
                        </blockquote>
                    </div>
                </div>
            </div>
        </div>
    );
}
