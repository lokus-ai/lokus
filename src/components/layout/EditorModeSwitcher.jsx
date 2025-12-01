import React, { useState, useEffect } from 'react';

const EditorModeSwitcher = () => {
    const [editorMode, setEditorMode] = useState('edit');

    useEffect(() => {
        // Event-driven mode sync instead of polling
        const handleModeChange = (event) => {
            setEditorMode(event.detail || 'edit');
        };

        // Listen for custom event
        window.addEventListener('lokusEditorModeChange', handleModeChange);

        // Get initial mode
        if (window.__LOKUS_EDITOR_MODE__) {
            setEditorMode(window.__LOKUS_EDITOR_MODE__);
        }

        return () => {
            window.removeEventListener('lokusEditorModeChange', handleModeChange);
        };
    }, []);

    const handleModeChange = (mode) => {
        if (window.__LOKUS_SET_EDITOR_MODE__) {
            window.__LOKUS_SET_EDITOR_MODE__(mode);
        }
        setEditorMode(mode);

        // Dispatch event so other components can listen
        window.dispatchEvent(new CustomEvent('lokusEditorModeChange', { detail: mode }));
    };

    return (
        <div style={{
            padding: '0.75rem',
            borderBottom: '1px solid rgb(var(--border))',
            background: 'rgb(var(--panel))'
        }}>
            <div style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'rgb(var(--muted))',
                marginBottom: '0.5rem'
            }}>
                Editor Mode
            </div>
            <div style={{
                display: 'flex',
                gap: '0.25rem',
                background: 'rgb(var(--bg))',
                border: '1px solid rgb(var(--border))',
                borderRadius: '0.5rem',
                padding: '0.25rem'
            }}>
                <button
                    onClick={() => handleModeChange('edit')}
                    title="Edit Mode"
                    style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        background: editorMode === 'edit' ? 'rgb(var(--accent))' : 'transparent',
                        color: editorMode === 'edit' ? 'white' : 'rgb(var(--text))',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: editorMode === 'edit' ? 600 : 500,
                        transition: 'all 0.15s ease'
                    }}
                >
                    Edit
                </button>
                <button
                    onClick={() => handleModeChange('live')}
                    title="Live Preview Mode"
                    style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        background: editorMode === 'live' ? 'rgb(var(--accent))' : 'transparent',
                        color: editorMode === 'live' ? 'white' : 'rgb(var(--text))',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: editorMode === 'live' ? 600 : 500,
                        transition: 'all 0.15s ease'
                    }}
                >
                    Live
                </button>
                <button
                    onClick={() => handleModeChange('reading')}
                    title="Reading Mode"
                    style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        background: editorMode === 'reading' ? 'rgb(var(--accent))' : 'transparent',
                        color: editorMode === 'reading' ? 'white' : 'rgb(var(--text))',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: editorMode === 'reading' ? 600 : 500,
                        transition: 'all 0.15s ease'
                    }}
                >
                    Read
                </button>
            </div>
        </div>
    );
};

export default EditorModeSwitcher;
