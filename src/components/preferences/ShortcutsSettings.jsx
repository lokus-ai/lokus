import React, { useState, useEffect } from "react";
import { Search, RotateCcw, Pencil } from "lucide-react";
import { readConfig, updateConfig } from "../../core/config/store.js";

// Keycap component for displaying shortcut keys
function Keycap({ children }) {
    return (
        <kbd className="min-w-[20px] h-5 inline-flex items-center justify-center px-1.5 text-[10px] font-sans font-medium text-app-text bg-app-panel border border-app-border rounded shadow-sm">
            {children}
        </kbd>
    );
}

export default function ShortcutsSettings() {
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [keymap, setKeymap] = useState({
        'file:new': 'CmdOrCtrl+N',
        'file:open': 'CmdOrCtrl+O',
        'file:save': 'CmdOrCtrl+S',
        'app:settings': 'CmdOrCtrl+,',
        'view:toggle-sidebar': 'CmdOrCtrl+\\',
        'view:command-palette': 'CmdOrCtrl+K',
        'editor:bold': 'CmdOrCtrl+B',
        'editor:italic': 'CmdOrCtrl+I',
        'editor:link': 'CmdOrCtrl+K',
        'editor:code': 'CmdOrCtrl+E',
    });

    const actions = [
        { id: 'file:new', name: 'New File', category: 'File' },
        { id: 'file:open', name: 'Open File', category: 'File' },
        { id: 'file:save', name: 'Save File', category: 'File' },
        { id: 'app:settings', name: 'Open Settings', category: 'Application' },
        { id: 'view:toggle-sidebar', name: 'Toggle Sidebar', category: 'View' },
        { id: 'view:command-palette', name: 'Command Palette', category: 'View' },
        { id: 'editor:bold', name: 'Bold Text', category: 'Editor' },
        { id: 'editor:italic', name: 'Italic Text', category: 'Editor' },
        { id: 'editor:link', name: 'Insert Link', category: 'Editor' },
        { id: 'editor:code', name: 'Inline Code', category: 'Editor' },
    ];

    useEffect(() => {
        async function loadData() {
            try {
                const cfg = await readConfig();
                if (cfg.keymap) {
                    setKeymap(prev => ({ ...prev, ...cfg.keymap }));
                }
            } catch (e) {
                console.error('Failed to load keymap:', e);
            }
        }
        loadData();
    }, []);

    const formatAccelerator = (accel) => {
        if (!accel) return '';
        return accel.replace('CmdOrCtrl', '⌘').replace('Shift', '⇧').replace('Alt', '⌥');
    };

    const accelParts = (accel) => {
        if (!accel) return [];
        return accel.split('+').map(p => {
            if (p === 'CmdOrCtrl') return '⌘';
            if (p === 'Shift') return '⇧';
            if (p === 'Alt') return '⌥';
            if (p === 'Control') return '⌃';
            return p.toUpperCase();
        });
    };

    const beginEdit = (id) => {
        setEditing(id);
    };

    const cancelEdit = () => {
        setEditing(null);
    };

    const onKeyCapture = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            cancelEdit();
            return;
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
            const newKeymap = { ...keymap };
            delete newKeymap[id];
            setKeymap(newKeymap);
            await updateConfig({ keymap: newKeymap });
            setEditing(null);
            return;
        }

        // Build accelerator string
        const parts = [];
        if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');

        // Don't capture modifier keys alone
        if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;

        let key = e.key.toUpperCase();
        if (key === ' ') key = 'Space';
        parts.push(key);

        const accelerator = parts.join('+');
        const newKeymap = { ...keymap, [id]: accelerator };
        setKeymap(newKeymap);
        await updateConfig({ keymap: newKeymap });
        setEditing(null);
    };

    const onResetAll = async () => {
        const defaultKeymap = {
            'file:new': 'CmdOrCtrl+N',
            'file:open': 'CmdOrCtrl+O',
            'file:save': 'CmdOrCtrl+S',
            'app:settings': 'CmdOrCtrl+,',
            'view:toggle-sidebar': 'CmdOrCtrl+\\',
            'view:command-palette': 'CmdOrCtrl+K',
            'editor:bold': 'CmdOrCtrl+B',
            'editor:italic': 'CmdOrCtrl+I',
            'editor:link': 'CmdOrCtrl+K',
            'editor:code': 'CmdOrCtrl+E',
        };
        setKeymap(defaultKeymap);
        await updateConfig({ keymap: defaultKeymap });
    };

    return (
        <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search actions..."
                        className="w-full pl-8 pr-3 h-9 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
                    />
                </div>
                <button onClick={onResetAll} className="h-9 inline-flex items-center gap-2 px-3 rounded-md border border-app-border hover:bg-app-panel text-sm">
                    <RotateCcw className="w-4 h-4" /> Reset All
                </button>
            </div>

            <div className="rounded-lg border border-app-border overflow-hidden">
                <div className="grid grid-cols-12 bg-app-panel/40 px-4 py-2 text-xs text-app-muted">
                    <div className="col-span-7">Action</div>
                    <div className="col-span-3">Shortcut</div>
                    <div className="col-span-2 text-right">Edit</div>
                </div>
                <div className="divide-y divide-app-border/60">
                    {actions
                        .filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
                        .map(a => {
                            const accel = keymap[a.id];
                            const parts = accelParts(accel);
                            return (
                                <div key={a.id} className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                                    <div className="col-span-7 text-sm">{a.name}</div>
                                    <div className="col-span-3">
                                        {editing === a.id ? (
                                            <div className="inline-flex items-center gap-2">
                                                <span className="text-xs text-app-muted">Press keys…</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-1">
                                                {parts.length > 0 ? parts.map((p, i) => (
                                                    <Keycap key={i}>{p}</Keycap>
                                                )) : <span className="text-xs text-app-muted">Not set</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-2">
                                        {editing === a.id ? (
                                            <input
                                                autoFocus
                                                onKeyDown={(e) => onKeyCapture(e, a.id)}
                                                onBlur={cancelEdit}
                                                className="w-full h-8 text-center bg-app-bg border border-dashed border-app-border rounded outline-none"
                                                placeholder={formatAccelerator(accel) || "Press keys..."}
                                            />
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => beginEdit(a.id)}
                                                    className="h-8 inline-flex items-center gap-2 px-2 rounded-md border border-app-border hover:bg-app-panel text-xs"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}
