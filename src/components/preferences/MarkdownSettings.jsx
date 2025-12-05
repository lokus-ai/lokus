import React, { useState, useEffect } from "react";
import markdownSyntaxConfig from "../../core/markdown/syntax-config.js";
import { RotateCcw } from "lucide-react";

export default function MarkdownSettings() {
    const [markdownSyntax, setMarkdownSyntax] = useState(markdownSyntaxConfig.getAll());
    const [saveStatus, setSaveStatus] = useState('');

    // Subscribe to markdown syntax changes
    useEffect(() => {
        markdownSyntaxConfig.init();
        const unsubscribe = markdownSyntaxConfig.onChange(() => {
            setMarkdownSyntax(markdownSyntaxConfig.getAll());
        });
        return unsubscribe;
    }, []);

    return (
        <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-app-muted">Customize markdown syntax characters and behaviors</div>
                <button
                    onClick={() => markdownSyntaxConfig.reset()}
                    className="h-9 inline-flex items-center gap-2 px-3 rounded-md border border-app-border hover:bg-app-panel text-sm"
                >
                    <RotateCcw className="w-4 h-4" /> Reset All
                </button>
            </div>

            <div className="rounded-lg border border-app-border overflow-hidden">
                <div className="grid grid-cols-12 bg-app-panel/40 px-4 py-2 text-xs text-app-muted">
                    <div className="col-span-5">Syntax</div>
                    <div className="col-span-3">Marker</div>
                    <div className="col-span-4 text-right">Enabled</div>
                </div>
                <div className="divide-y divide-app-border/60">
                    {/* Headers */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="text-xl w-6 text-center">#</span>
                            <div>
                                <div className="text-sm">Headers</div>
                                <div className="text-xs text-app-muted">Heading marker</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="2"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.heading?.marker || '#'}
                                onChange={(e) => markdownSyntaxConfig.set('heading', 'marker', e.target.value)}
                                disabled={markdownSyntax.heading?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('heading', 'enabled', !(markdownSyntax.heading?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.heading?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.heading?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Bold */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="font-bold text-xl w-6 text-center">B</span>
                            <div>
                                <div className="text-sm">Bold</div>
                                <div className="text-xs text-app-muted">Wrapping characters for bold text</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="3"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.bold?.marker || '**'}
                                onChange={(e) => markdownSyntaxConfig.set('bold', 'marker', e.target.value)}
                                disabled={markdownSyntax.bold?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('bold', 'enabled', !(markdownSyntax.bold?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.bold?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.bold?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Italic */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="italic text-xl w-6 text-center">I</span>
                            <div>
                                <div className="text-sm">Italic</div>
                                <div className="text-xs text-app-muted">Wrapping characters for italic text</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="2"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.italic?.marker || '*'}
                                onChange={(e) => markdownSyntaxConfig.set('italic', 'marker', e.target.value)}
                                disabled={markdownSyntax.italic?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('italic', 'enabled', !(markdownSyntax.italic?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.italic?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.italic?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Inline Code */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="font-mono text-app-accent text-xl w-6 text-center">`</span>
                            <div>
                                <div className="text-sm">Inline Code</div>
                                <div className="text-xs text-app-muted">Wrapping character for code</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="2"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.inlineCode?.marker || '`'}
                                onChange={(e) => markdownSyntaxConfig.set('inlineCode', 'marker', e.target.value)}
                                disabled={markdownSyntax.inlineCode?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('inlineCode', 'enabled', !(markdownSyntax.inlineCode?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.inlineCode?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.inlineCode?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Strikethrough */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="line-through text-xl w-6 text-center">S</span>
                            <div>
                                <div className="text-sm">Strikethrough</div>
                                <div className="text-xs text-app-muted">Wrapping characters for strikethrough</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="3"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.strikethrough?.marker || '~~'}
                                onChange={(e) => markdownSyntaxConfig.set('strikethrough', 'marker', e.target.value)}
                                disabled={markdownSyntax.strikethrough?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('strikethrough', 'enabled', !(markdownSyntax.strikethrough?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.strikethrough?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.strikethrough?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Highlight */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="bg-yellow-200/30 px-1 text-xl w-6 text-center">H</span>
                            <div>
                                <div className="text-sm">Highlight</div>
                                <div className="text-xs text-app-muted">Wrapping characters for highlights</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="3"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.highlight?.marker || '=='}
                                onChange={(e) => markdownSyntaxConfig.set('highlight', 'marker', e.target.value)}
                                disabled={markdownSyntax.highlight?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('highlight', 'enabled', !(markdownSyntax.highlight?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.highlight?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.highlight?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Bullet Lists */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="text-xl w-6 text-center">•</span>
                            <div>
                                <div className="text-sm">Bullet Lists</div>
                                <div className="text-xs text-app-muted">Default list marker</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <select
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.bulletList?.defaultMarker || '-'}
                                onChange={(e) => markdownSyntaxConfig.set('bulletList', 'defaultMarker', e.target.value)}
                                disabled={markdownSyntax.bulletList?.enabled === false}
                            >
                                {(markdownSyntax.bulletList?.markers || ['*', '-', '+']).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('bulletList', 'enabled', !(markdownSyntax.bulletList?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.bulletList?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.bulletList?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Blockquote */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="text-app-muted text-xl w-6 text-center">&gt;</span>
                            <div>
                                <div className="text-sm">Blockquote</div>
                                <div className="text-xs text-app-muted">Quote line prefix</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="2"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.blockquote?.marker || '>'}
                                onChange={(e) => markdownSyntaxConfig.set('blockquote', 'marker', e.target.value)}
                                disabled={markdownSyntax.blockquote?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('blockquote', 'enabled', !(markdownSyntax.blockquote?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.blockquote?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.blockquote?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Wiki Links */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="text-app-accent w-6 text-center font-mono text-xl">[[</span>
                            <div>
                                <div className="text-sm">Wiki Links</div>
                                <div className="text-xs text-app-muted">Opening/closing brackets</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    maxLength="3"
                                    className="w-9 px-1 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                    value={markdownSyntax.link?.wikiLink?.open || '[['}
                                    onChange={(e) => markdownSyntaxConfig.set('link', { ...markdownSyntax.link, wikiLink: { ...markdownSyntax.link?.wikiLink, open: e.target.value } })}
                                    disabled={markdownSyntax.link?.wikiLink?.enabled === false}
                                />
                                <input
                                    type="text"
                                    maxLength="3"
                                    className="w-9 px-1 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                    value={markdownSyntax.link?.wikiLink?.close || ']]'}
                                    onChange={(e) => markdownSyntaxConfig.set('link', { ...markdownSyntax.link, wikiLink: { ...markdownSyntax.link?.wikiLink, close: e.target.value } })}
                                    disabled={markdownSyntax.link?.wikiLink?.enabled === false}
                                />
                            </div>
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('link', { ...markdownSyntax.link, wikiLink: { ...markdownSyntax.link?.wikiLink, enabled: !(markdownSyntax.link?.wikiLink?.enabled !== false) } })}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.link?.wikiLink?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.link?.wikiLink?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Images */}
                    <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                        <div className="col-span-5 flex items-center gap-3">
                            <span className="text-xl w-6 text-center">🖼</span>
                            <div>
                                <div className="text-sm">Images</div>
                                <div className="text-xs text-app-muted">Image prefix marker</div>
                            </div>
                        </div>
                        <div className="col-span-3">
                            <input
                                type="text"
                                maxLength="2"
                                className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                                value={markdownSyntax.image?.marker || '!'}
                                onChange={(e) => markdownSyntaxConfig.set('image', 'marker', e.target.value)}
                                disabled={markdownSyntax.image?.enabled === false}
                            />
                        </div>
                        <div className="col-span-4 flex justify-end">
                            <button
                                onClick={() => markdownSyntaxConfig.set('image', 'enabled', !(markdownSyntax.image?.enabled !== false))}
                                className={`w-12 h-6 rounded-full transition-colors relative ${markdownSyntax.image?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-app-bg absolute top-1 transition-transform ${markdownSyntax.image?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
                <button
                    onClick={() => {
                        const json = markdownSyntaxConfig.export();
                        navigator.clipboard.writeText(json);
                        alert('Copied to clipboard!');
                    }}
                    className="px-4 py-2 text-sm rounded-lg border border-app-border hover:bg-app-panel transition-colors"
                >
                    Export
                </button>
                <button
                    onClick={async () => {
                        const saved = await markdownSyntaxConfig.save();
                        setSaveStatus(saved ? 'success' : 'error');
                        setTimeout(() => setSaveStatus(''), 3000);

                        // Emit event to notify other windows to reload config
                        if (saved) {
                            try {
                                const { emit } = await import('@tauri-apps/api/event');
                                await emit('lokus:markdown-config-changed', {
                                    config: markdownSyntaxConfig.getAll()
                                });
                                if (import.meta.env.DEV) {
                                    console.log('[Preferences] Emitted lokus:markdown-config-changed event');
                                }
                            } catch (e) {
                                console.error('[Preferences] Failed to emit config change event:', e);
                            }
                        }
                    }}
                    className="px-6 py-2 text-sm rounded-lg bg-app-accent text-white hover:bg-app-accent/90 transition-colors relative"
                >
                    {saveStatus === 'success' ? '✓ Saved!' : saveStatus === 'error' ? '✗ Failed' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
}
