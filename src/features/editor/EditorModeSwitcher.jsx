import { useState, useEffect } from 'react';

export function EditorModeSwitcher() {
  const [editorMode, setEditorMode] = useState('edit');

  useEffect(() => {
    const handleModeChange = (event) => {
      setEditorMode(event.detail || 'edit');
    };
    window.addEventListener('lokusEditorModeChange', handleModeChange);
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
    window.dispatchEvent(new CustomEvent('lokusEditorModeChange', { detail: mode }));
  };

  const modes = [
    { key: 'edit', label: 'Edit', title: 'Edit Mode' },
    { key: 'live', label: 'Live', title: 'Live Preview Mode' },
    { key: 'reading', label: 'Read', title: 'Reading Mode' },
  ];

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
        {modes.map(({ key, label, title }) => (
          <button
            key={key}
            onClick={() => handleModeChange(key)}
            title={title}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: editorMode === key ? 'rgb(var(--accent))' : 'transparent',
              color: editorMode === key ? 'white' : 'rgb(var(--text))',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: editorMode === key ? 600 : 500,
              transition: 'all 0.15s ease'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
