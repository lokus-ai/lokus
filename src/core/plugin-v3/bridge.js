export class BridgeError extends Error {
  constructor(message, code = 'bridge') {
    super(message);
    this.code = code;
  }
}

export function createBridge({ pluginId, gate, effects, contributions }) {
  async function dispatch(method, args = {}) {
    const decision = gate.check(method);
    if (!decision.allowed) {
      if (decision.reason === 'unknown-method') {
        throw new BridgeError(`unknown API method: ${method}`, 'unknown-method');
      }
      throw new BridgeError(
        `permission denied: "${method}" requires the "${decision.capability}" capability`,
        'denied'
      );
    }

    switch (method) {
      case 'ui.notify':
        effects.toast(String(args.message || ''), args.type || 'info', args.title);
        return true;

      case 'ui.statusbar': {
        const { itemId, patch } = args;
        if (!itemId || typeof patch !== 'object') throw new BridgeError('statusbar update needs itemId + patch');
        let updated = contributions.updateRuntime(pluginId, 'statusBar', itemId, patch);
        if (!updated && contributions.isDeclared(pluginId, 'statusBar', itemId)) {
          contributions.addRuntime(pluginId, 'statusBar', { id: itemId, ...patch });
          updated = true;
        }
        if (!updated) throw new BridgeError(`status bar item "${itemId}" is not declared in the manifest`);
        return true;
      }

      case 'commands.execute':
        return effects.executeCommand(String(args.id || ''), args.args || {});

      case 'editor.insert':
        await effects.insertIntoEditor(String(args.text || ''));
        return true;

      case 'notes.list':
        return effects.listNotes(pluginId, args);

      case 'notes.read':
        return effects.readNote(pluginId, String(args.path || ''));

      case 'notes.write':
        return effects.writeNote(pluginId, String(args.path || ''), String(args.content || ''));

      case 'storage.get':
        return effects.storageGet(pluginId, String(args.key || ''));

      case 'storage.set':
        return effects.storageSet(pluginId, String(args.key || ''), args.value);

      case 'storage.delete':
        return effects.storageDelete(pluginId, String(args.key || ''));

      case 'network.fetch':
        return effects.netFetch(pluginId, String(args.url || ''), args.opts || {});

      case 'overlay.show':
        return effects.showOverlay(pluginId, String(args.overlayId || ''));

      case 'overlay.hide':
        return effects.hideOverlay(pluginId, String(args.overlayId || ''));

      case 'workspace.info':
        return effects.workspaceInfo();

      default:
        throw new BridgeError(`unhandled method: ${method}`, 'unknown-method');
    }
  }

  return { dispatch };
}
