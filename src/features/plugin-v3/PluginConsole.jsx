import React, { useState } from 'react';
import { host } from '../../core/plugin-v3/index.js';
import { usePluginRecord } from './hooks.js';

const LEVEL_COLORS = {
  error: 'text-red-500',
  warn: 'text-yellow-600',
  info: 'text-app-muted',
  log: 'text-app-muted',
  debug: 'text-app-muted',
};

export default function PluginConsole({ pluginId, onClose }) {
  const plugin = usePluginRecord(pluginId);
  const [tab, setTab] = useState('log');

  if (!pluginId) return null;
  const logs = host.getLogs(pluginId);
  const audit = host.getAudit(pluginId).filter((d) => !d.allowed);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="flex h-[480px] w-[640px] max-w-[94vw] flex-col rounded-lg border border-app-border bg-app-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-app-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-app-text">
              {plugin?.name || pluginId}
            </h2>
            <p className="text-xs text-app-muted">
              status: {plugin?.status || 'unknown'}
              {plugin?.health?.lastError ? ` · last error: ${plugin.health.lastError}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm text-app-muted hover:bg-app-border/50">
            Close
          </button>
        </div>

        <div className="flex gap-1 border-b border-app-border px-5 pt-2">
          {[['log', `Log (${logs.length})`], ['blocked', `Blocked calls (${audit.length})`]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-t px-3 py-1.5 text-xs ${tab === key ? 'bg-app-border/60 text-app-text' : 'text-app-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-5 py-3 font-mono text-xs">
          {tab === 'log' && (
            logs.length === 0
              ? <p className="text-app-muted">No log output.</p>
              : logs.map((entry, i) => (
                <div key={i} className={LEVEL_COLORS[entry.level] || 'text-app-text'}>
                  <span className="opacity-60">{new Date(entry.at).toLocaleTimeString()}</span>{' '}
                  [{entry.level}] {entry.message}
                </div>
              ))
          )}
          {tab === 'blocked' && (
            audit.length === 0
              ? <p className="text-app-muted">Nothing has been blocked. This plugin stayed inside its permissions.</p>
              : audit.map((d, i) => (
                <div key={i} className="text-yellow-600">
                  {d.method} — needs “{d.capability}” — {new Date(d.at).toLocaleTimeString()}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
