import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { convertFileSrc } from '@tauri-apps/api/core';
import { host } from '../../core/plugin-v3/index.js';
import { useContributed } from './hooks.js';

function DeclarativeContent({ spec }) {
  if (!spec || typeof spec !== 'object') return null;
  return (
    <div className="space-y-2 p-3 text-sm text-app-text">
      {spec.text && <p>{String(spec.text)}</p>}
      {spec.markdown && (
        <div className="plugin-panel-markdown">
          <ReactMarkdown>{String(spec.markdown)}</ReactMarkdown>
        </div>
      )}
      {Array.isArray(spec.buttons) && spec.buttons.slice(0, 10).map((b, i) => (
        <button
          key={i}
          className="rounded border border-app-border px-3 py-1.5 text-xs hover:bg-app-border/40"
          onClick={() => {
            if (b.command) host.triggerCommand(`${b.pluginId || ''}${b.command}`.replace(/^\./, ''));
          }}
        >
          {String(b.label || b.command || 'button')}
        </button>
      ))}
    </div>
  );
}

function PluginPanel({ panel }) {
  const record = host.get(panel.pluginId);
  const content = panel.content || {};

  const body = useMemo(() => {
    if (content.type === 'webview' && record?.path) {
      const src = convertFileSrc(`${record.path}/${content.src}`);
      return (
        <iframe
          src={src}
          title={panel.title}
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts"
        />
      );
    }
    if (content.type === 'declarative') return <DeclarativeContent spec={content.spec} />;
    return <p className="p-3 text-xs text-app-muted">Unsupported panel content.</p>;
  }, [content, record?.path, panel.title]);

  return (
    <div className="border-t border-app-border">
      <div className="flex items-center justify-between bg-app-panel px-3 py-1.5">
        <span className="text-xs font-medium text-app-text">{panel.title}</span>
        <span className="text-[10px] text-app-muted">{panel.pluginId}</span>
      </div>
      <div className="max-h-80 overflow-auto">{body}</div>
    </div>
  );
}

export function PluginPanelsRegion({ position }) {
  const panels = useContributed('panels');
  const mine = panels.filter((p) => (p.position || 'right') === position);
  if (mine.length === 0) return null;
  return (
    <div className="plugin-panels-region">
      {mine.map((p) => <PluginPanel key={p.qualifiedId} panel={p} />)}
    </div>
  );
}
