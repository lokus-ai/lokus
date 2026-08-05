import { commandRegistry } from '../../plugins/registry/CommandRegistry.js';
import { editorAPI } from '../../plugins/api/EditorAPI.js';

function makeInsertHandler(text) {
  return (ctx) => {
    const view = ctx?.view || ctx?.editor || editorAPI.editorInstance;
    if (!view || !view.state) return;
    try {
      let tr = view.state.tr;
      let pos = view.state.selection.from;
      if (ctx?.range) {
        tr = tr.delete(ctx.range.from, ctx.range.to);
        pos = tr.mapping.map(ctx.range.from);
      }
      tr = tr.insertText(String(text || ''), pos);
      view.dispatch(tr.scrollIntoView());
      view.dom?.focus?.({ preventScroll: true });
    } catch { /* insertion must never crash the editor */ }
  };
}

export function startSlotSync(host, contributions) {
  const activeCommands = new Set();
  const editorPlugins = new Set();
  let commandListenerBound = false;

  function syncCommands() {
    const wanted = new Map();
    for (const c of contributions.commands()) wanted.set(c.qualifiedId, c);

    for (const id of [...activeCommands]) {
      if (!wanted.has(id)) {
        try { commandRegistry.unregister(id); } catch { /* already gone */ }
        activeCommands.delete(id);
      }
    }

    for (const [qualifiedId, c] of wanted) {
      if (activeCommands.has(qualifiedId) || commandRegistry.exists(qualifiedId)) continue;
      try {
        commandRegistry.register({
          id: qualifiedId,
          title: c.title,
          icon: c.icon || null,
          category: 'Plugins',
          pluginId: c.pluginId,
          handler: () => host.triggerCommand(qualifiedId),
        });
        activeCommands.add(qualifiedId);
      } catch { /* malformed contribution — skip, do not break the palette */ }
    }
  }

  function syncEditorSlots() {
    const wanted = new Set();
    for (const s of contributions.slashCommands()) wanted.add(s.pluginId);
    for (const t of contributions.toolbar()) wanted.add(t.pluginId);

    for (const pluginId of [...editorPlugins]) {
      if (!wanted.has(pluginId)) {
        try { editorAPI.unregisterPlugin(pluginId); } catch { /* nothing to clean */ }
        editorPlugins.delete(pluginId);
      }
    }

    for (const pluginId of wanted) {
      if (editorPlugins.has(pluginId)) continue;
      try {
        for (const s of contributions.slashCommands().filter((x) => x.pluginId === pluginId)) {
          editorAPI.registerSlashCommand(pluginId, {
            id: s.name,
            title: `/${s.name}`,
            description: s.description || '',
            handler: makeInsertHandler(s.insert),
          });
        }
        for (const t of contributions.toolbar().filter((x) => x.pluginId === pluginId)) {
          editorAPI.registerToolbarItem(pluginId, {
            id: t.id,
            icon: t.icon,
            tooltip: t.tooltip,
            title: t.tooltip,
            handler: () => host.triggerCommand(`${pluginId}.${t.command}`),
          });
        }
        editorPlugins.add(pluginId);
      } catch { /* malformed contribution — skip */ }
    }
  }

  function onCommandForwarded(e) {
    const { id, args } = e.detail || {};
    if (id && commandRegistry.exists(id)) {
      commandRegistry.execute(id, args).catch(() => {});
    }
  }

  if (typeof window !== 'undefined' && !commandListenerBound) {
    window.addEventListener('pv3:command', onCommandForwarded);
    commandListenerBound = true;
  }

  const sync = () => {
    syncCommands();
    syncEditorSlots();
  };
  const unsubscribe = contributions.subscribe(sync);
  sync();

  return () => {
    unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pv3:command', onCommandForwarded);
      commandListenerBound = false;
    }
  };
}
