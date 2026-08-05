import React, { useEffect, useState } from 'react';
import { CAPABILITIES } from '../../core/plugin-v3/contract.js';

export default function AskScreen({ request, onAllow, onCancel }) {
  const [selected, setSelected] = useState(() => new Set(request?.manifest?.capabilities || []));

  useEffect(() => {
    setSelected(new Set(request?.manifest?.capabilities || []));
  }, [request]);

  if (!request) return null;
  const { manifest } = request;
  const caps = manifest.capabilities || [];

  const toggle = (cap) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="w-[440px] max-w-[92vw] rounded-lg border border-app-border bg-app-bg shadow-xl">
        <div className="border-b border-app-border px-5 py-4">
          <h2 className="text-base font-semibold text-app-text">Install “{manifest.name}”?</h2>
          <p className="mt-1 text-xs text-app-muted">
            {manifest.id} · v{manifest.version}{manifest.author ? ` · by ${manifest.author}` : ''}
          </p>
        </div>

        <div className="px-5 py-4">
          {manifest.description && (
            <p className="mb-3 text-sm text-app-text">{manifest.description}</p>
          )}

          {caps.length === 0 ? (
            <p className="text-sm text-app-muted">This plugin asks for no special permissions.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">
                It will be able to:
              </p>
              <ul className="space-y-2">
                {caps.map((cap) => (
                  <li key={cap}>
                    <label className="flex items-start gap-2 text-sm text-app-text">
                      <input
                        type="checkbox"
                        checked={selected.has(cap)}
                        onChange={() => toggle(cap)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{cap}</span>
                        <span className="block text-xs text-app-muted">
                          {CAPABILITIES[cap] || cap}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-app-muted">
                You can change these anytime in plugin settings. Unchecked permissions are denied forever
                unless you allow them later.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-app-border px-5 py-3">
          <button
            className="rounded px-3 py-1.5 text-sm text-app-muted hover:bg-app-border/50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded bg-app-accent px-3 py-1.5 text-sm font-medium text-app-accent-fg hover:opacity-90"
            onClick={() => onAllow(Array.from(selected))}
          >
            Allow & install
          </button>
        </div>
      </div>
    </div>
  );
}
